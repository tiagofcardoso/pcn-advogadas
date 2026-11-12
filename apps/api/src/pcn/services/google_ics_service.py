"""Google Calendar iCal (.ics) reader with strict SSRF validation and TTL caching."""

import asyncio
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pcn.core.errors import BusinessRuleViolation


def _resolve_lisbon_tz() -> tzinfo:
    try:
        return ZoneInfo("Europe/Lisbon")
    except ZoneInfoNotFoundError:
        return UTC


_LISBON_TZ = _resolve_lisbon_tz()
_ALLOWED_HOSTS = frozenset({"calendar.google.com", "www.google.com"})
_CACHE_TTL_SECONDS = 60.0

# In-memory cache keyed by URL -> (fetched_monotonic_ts, events_list)
_ICS_CACHE: dict[str, tuple[float, list["ParsedIcsEvent"]]] = {}


@dataclass(frozen=True)
class ParsedIcsEvent:
    uid: str
    title: str
    subtitle: str | None
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    event_type: str  # Compromisso | Diligência | Prazo | Férias / Ausência


def validate_google_ics_url(url: str) -> str:
    """Validates that the URL is a legitimate HTTPS Google Calendar .ics feed (SSRF guard)."""
    clean = (url or "").strip()
    if not clean:
        return ""
    parsed = urllib.parse.urlparse(clean)
    if parsed.scheme != "https":
        raise BusinessRuleViolation(
            "O link iCal do Google Calendar deve começar por https://."
        )
    hostname = (parsed.hostname or "").lower()
    if hostname not in _ALLOWED_HOSTS:
        raise BusinessRuleViolation(
            "Apenas são permitidos links oficiais do Google Calendar (calendar.google.com)."
        )
    if not (parsed.path.endswith(".ics") or "/ical/" in parsed.path):
        raise BusinessRuleViolation(
            "O link deve ser o endereço iCal (.ics) do Google Calendar."
        )
    return clean


def mask_ics_url(url: str | None) -> str | None:
    """Masks the private token segment in Google secret iCal URLs for safe display."""
    if not url:
        return None
    if "/private-" in url:
        prefix, rest = url.split("/private-", 1)
        slash_idx = rest.find("/")
        suffix = rest[slash_idx:] if slash_idx != -1 else ""
        return f"{prefix}/private-********{suffix}"
    return url


def _unfold_ics_lines(raw_text: str) -> list[str]:
    """Unfolds RFC 5545 folded lines (CRLF/LF followed by space or tab)."""
    normalized = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    lines: list[str] = []
    for line in normalized.split("\n"):
        if (line.startswith(" ") or line.startswith("\t")) and lines:
            lines[-1] += line[1:]
        else:
            lines.append(line)
    return lines


def _unescape_ics_text(val: str) -> str:
    return (
        val.replace("\\n", "\n")
        .replace("\\N", "\n")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
        .strip()
    )


def _parse_ics_dt(raw_val: str) -> tuple[str, str] | None:
    """Parses DTSTART (YYYYMMDD or YYYYMMDDTHHMMSS[Z]) into (YYYY-MM-DD, HH:MM) in Europe/Lisbon."""
    val = raw_val.strip()
    if not val:
        return None
    if len(val) == 8 and val.isdigit():
        # All-day event
        return f"{val[0:4]}-{val[4:6]}-{val[6:8]}", "09:00"
    is_utc = val.endswith("Z")
    core = val[:-1] if is_utc else val
    if "T" not in core or len(core) < 15:
        return None
    try:
        dt = datetime.strptime(core[:15], "%Y%m%dT%H%M%S")
        if is_utc:
            dt = dt.replace(tzinfo=UTC).astimezone(_LISBON_TZ)
        else:
            dt = dt.replace(tzinfo=_LISBON_TZ)
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except ValueError:
        return None


def _classify_google_event(title: str, description: str | None) -> str:
    combined = f"{title} {description or ''}".lower()
    if "prazo" in combined:
        return "Prazo"
    if "férias" in combined or "ferias" in combined or "ausência" in combined or "ausencia" in combined:
        return "Férias / Ausência"
    if "diligência" in combined or "diligencia" in combined or "audiência" in combined or "audiencia" in combined:
        return "Diligência"
    return "Compromisso"


def parse_ics_events(raw_ics: str) -> list[ParsedIcsEvent]:
    """Parses VEVENT entries from an iCalendar payload within [-30d, +365d]."""
    today = datetime.now(_LISBON_TZ).date()
    min_date = (today - timedelta(days=30)).isoformat()
    max_date = (today + timedelta(days=365)).isoformat()

    events: list[ParsedIcsEvent] = []
    in_event = False
    cur: dict[str, str] = {}

    for line in _unfold_ics_lines(raw_ics):
        if line == "BEGIN:VEVENT":
            in_event = True
            cur = {}
            continue
        if line == "END:VEVENT":
            in_event = False
            dt_parsed = _parse_ics_dt(cur.get("DTSTART", ""))
            summary = _unescape_ics_text(cur.get("SUMMARY", ""))
            if dt_parsed and summary:
                ev_date, ev_time = dt_parsed
                if min_date <= ev_date <= max_date:
                    desc = _unescape_ics_text(cur.get("DESCRIPTION", ""))
                    loc = _unescape_ics_text(cur.get("LOCATION", ""))
                    subtitle_parts = [p for p in (loc, desc) if p]
                    subtitle = " · ".join(subtitle_parts)[:180] if subtitle_parts else None
                    uid = (cur.get("UID") or f"{ev_date}_{ev_time}_{summary[:24]}").strip()
                    events.append(
                        ParsedIcsEvent(
                            uid=uid,
                            title=summary,
                            subtitle=subtitle,
                            date=ev_date,
                            time=ev_time,
                            event_type=_classify_google_event(summary, subtitle),
                        )
                    )
            cur = {}
            continue
        if not in_event or ":" not in line:
            continue

        key_part, val_part = line.split(":", 1)
        prop_name = key_part.split(";", 1)[0].upper()
        if prop_name in {"UID", "SUMMARY", "DESCRIPTION", "LOCATION", "DTSTART"}:
            cur[prop_name] = val_part

    events.sort(key=lambda e: f"{e.date} {e.time}")
    return events[:200]


def _download_ics_sync(url: str) -> str:
    req = urllib.request.Request(  # noqa: S310 - URL strictly validated by validate_google_ics_url
        url,
        headers={"User-Agent": "PCN-Advogadas-AgendaSync/1.0"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=8) as resp:  # noqa: S310
        charset = resp.headers.get_content_charset() or "utf-8"
        raw_bytes = resp.read(2 * 1024 * 1024)  # 2 MB cap
        return raw_bytes.decode(charset, errors="replace")


async def fetch_google_ics_events(
    url: str, force_refresh: bool = False
) -> list[ParsedIcsEvent]:
    """Fetches and caches Google Calendar events from the validated .ics feed."""
    clean_url = validate_google_ics_url(url)
    if not clean_url:
        return []

    now_mono = time.monotonic()
    cached = _ICS_CACHE.get(clean_url)
    if not force_refresh and cached and (now_mono - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    raw_text = await asyncio.to_thread(_download_ics_sync, clean_url)
    parsed = parse_ics_events(raw_text)
    _ICS_CACHE[clean_url] = (now_mono, parsed)
    return parsed
