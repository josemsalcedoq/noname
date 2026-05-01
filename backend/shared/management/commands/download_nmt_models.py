from django.core.management.base import BaseCommand

from shared.nmt.engine import _models_root  # ensures ARGOS_PACKAGES_DIR is set
from shared.nmt.manager import ensure_pair


class Command(BaseCommand):
    help = "Download Argos NMT language pairs into MODELS_DIR (default: en<->es)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--pairs",
            nargs="*",
            default=["en:es", "es:en"],
            help="Language pairs to install, formatted as 'from:to'.",
        )

    def handle(self, *args, **options):
        self.stdout.write(f"Argos packages dir: {_models_root}")
        for pair in options["pairs"]:
            from_code, to_code = pair.split(":")
            installed = ensure_pair(from_code, to_code)
            status = self.style.SUCCESS("installed") if installed else "already present"
            self.stdout.write(f"  {from_code} -> {to_code}: {status}")
