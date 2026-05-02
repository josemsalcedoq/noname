import argostranslate.package


def installed_pairs() -> list[tuple[str, str]]:
    return [(pkg.from_code, pkg.to_code) for pkg in argostranslate.package.get_installed_packages()]


def ensure_pair(from_code: str, to_code: str) -> bool:
    if (from_code, to_code) in installed_pairs():
        return False
    argostranslate.package.update_package_index()
    available = argostranslate.package.get_available_packages()
    package = next(
        (p for p in available if p.from_code == from_code and p.to_code == to_code),
        None,
    )
    if package is None:
        raise RuntimeError(f"No Argos package available for {from_code}->{to_code}")
    package.install()
    return True
