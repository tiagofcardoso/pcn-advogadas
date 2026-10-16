"""Portuguese NIF (Número de Identificação Fiscal) validation — mod-11 check digit."""

_VALID_FIRST_DIGITS = ("1", "2", "3", "5", "6", "8", "9")


def normalize_nif(value: str) -> str:
    cleaned = value.strip().upper().removeprefix("PT").replace(" ", "")
    return cleaned


def is_valid_nif(value: str) -> bool:
    nif = normalize_nif(value)
    if len(nif) != 9 or not nif.isdigit():
        return False
    if not nif.startswith(_VALID_FIRST_DIGITS) and nif[:2] not in (
        "45",
        "70",
        "71",
        "72",
        "74",
        "75",
        "77",
        "79",
    ):
        return False
    total = sum(int(digit) * weight for digit, weight in zip(nif[:8], range(9, 1, -1), strict=True))
    check = 11 - (total % 11)
    if check >= 10:
        check = 0
    return check == int(nif[8])
