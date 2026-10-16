"""Cálculo de Prazos Processuais Judiciais em Portugal (Art. 138.º do Código de Processo Civil).

Regras processuais aplicadas:
1. Contagem contínua dos prazos (art. 138.º, n.º 1 CPC).
2. Não corre o dia inicial da notificação/citação (art. 279.º, al. b) do Código Civil).
3. Suspensão durante as férias judiciais (art. 138.º, n.º 1 CPC):
   - Férias de Verão: 16 de julho a 31 de agosto.
   - Férias de Natal: 22 de dezembro a 3 de janeiro.
   - Férias da Páscoa: do Domingo de Ramos à Segunda-feira de Páscoa (inclusive).
   - Exceção: Em processos urgentes (is_urgent=True), o prazo NÃO se suspende em férias judiciais.
4. Transferência para o 1.º dia útil subsequente se o termo do prazo coincidir com sábado,
   domingo, feriado ou dia em que os tribunais estejam encerrados (art. 138.º, n.º 2 CPC).
5. Art. 139.º, n.º 5 CPC (3 dias úteis com multa processual) — cálculo informativo das datas limite.
"""

from dataclasses import dataclass
from datetime import date, timedelta


def easter_date(year: int) -> date:
    """Algoritmo de Meeus/Jones/Butcher para determinar a data do Domingo de Páscoa."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def national_holidays_portugal(year: int) -> set[date]:
    """Feriados nacionais obrigatórios em Portugal para um determinado ano."""
    easter = easter_date(year)
    good_friday = easter - timedelta(days=2)
    corpus_christi = easter + timedelta(days=60)

    holidays = {
        date(year, 1, 1),  # Ano Novo
        date(year, 4, 25),  # Dia da Liberdade
        date(year, 5, 1),  # Dia do Trabalhador
        date(year, 6, 10),  # Dia de Portugal
        date(year, 8, 15),  # Assunção de Nossa Senhora
        date(year, 10, 5),  # Implantação da República
        date(year, 11, 1),  # Todos os Santos
        date(year, 12, 1),  # Restauração da Independência
        date(year, 12, 8),  # Imaculada Conceição
        date(year, 12, 25),  # Natal
        good_friday,  # Sexta-feira Santa
        easter,  # Páscoa
        corpus_christi,  # Corpo de Deus
    }
    return holidays


def is_judicial_vacation(current_date: date) -> bool:
    """Verifica se uma data recai em período de férias judiciais (art. 28.º da LOSJ)."""
    month, day = current_date.month, current_date.day

    # Férias de Verão: 16 de julho a 31 de agosto
    if (month == 7 and day >= 16) or month == 8:
        return True

    # Férias de Natal: 22 de dezembro a 3 de janeiro
    if (month == 12 and day >= 22) or (month == 1 and day <= 3):
        return True

    # Férias da Páscoa: de Domingo de Ramos até Segunda-feira de Páscoa
    easter = easter_date(current_date.year)
    palm_sunday = easter - timedelta(days=7)
    easter_monday = easter + timedelta(days=1)
    if palm_sunday <= current_date <= easter_monday:
        return True

    return False


def is_business_day(current_date: date) -> bool:
    """Dia útil para efeitos forenses (não é sábado, domingo nem feriado nacional)."""
    if current_date.weekday() in (5, 6):  # Sábado ou Domingo
        return False
    holidays = national_holidays_portugal(current_date.year)
    return current_date not in holidays


@dataclass(frozen=True, slots=True)
class JudicialDeadlineResult:
    start_date: date
    days_count: int
    is_urgent: bool
    final_deadline: date
    penalty_day_1: date  # Art. 139º nº 5 al. a) CPC
    penalty_day_2: date  # Art. 139º nº 5 al. b) CPC
    penalty_day_3: date  # Art. 139º nº 5 al. c) CPC
    suspended_vacation_days: int


def calculate_judicial_deadline(
    start_date: date, days: int, is_urgent: bool = False
) -> JudicialDeadlineResult:
    """Calcula a data limite de um prazo judicial segundo o art. 138.º do CPC.

    :param start_date: Data do evento/notificação. O primeiro dia da contagem é start_date + 1.
    :param days: Número de dias do prazo (ex: 10, 20, 30).
    :param is_urgent: Se True, não se suspende em férias judiciais (art. 138.º, n.º 1 in fine).
    """
    if days <= 0:
        raise ValueError("O prazo em dias deve ser superior a zero.")

    current = start_date + timedelta(days=1)
    counted = 0
    suspended_days = 0

    while counted < days:
        if not is_urgent and is_judicial_vacation(current):
            suspended_days += 1
        else:
            counted += 1
            if counted == days:
                break
        current += timedelta(days=1)

    # Se o dia em que o prazo termina for sábado, domingo ou feriado,
    # transfere-se para o 1.º dia útil subsequente (art. 138.º, n.º 2 CPC).
    final_deadline = current
    while not is_business_day(final_deadline):
        final_deadline += timedelta(days=1)

    # 3 dias úteis subsequentes para prática do ato com multa (Art. 139.º, n.º 5 CPC)
    penalty_days = []
    p_curr = final_deadline + timedelta(days=1)
    while len(penalty_days) < 3:
        if is_business_day(p_curr):
            penalty_days.append(p_curr)
        p_curr += timedelta(days=1)

    return JudicialDeadlineResult(
        start_date=start_date,
        days_count=days,
        is_urgent=is_urgent,
        final_deadline=final_deadline,
        penalty_day_1=penalty_days[0],
        penalty_day_2=penalty_days[1],
        penalty_day_3=penalty_days[2],
        suspended_vacation_days=suspended_days,
    )
