from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services


class CatalogView(APIView):
    def get(self, request):
        refresh = request.query_params.get("refresh") == "true"
        try:
            entries = services.fetch_catalog(refresh=refresh)
        except Exception as exc:  # noqa: BLE001 — surface as a 502 below
            return Response(
                {"error": "upstream_unavailable", "detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        installed = services.list_installed_names()
        return Response(
            {
                "skills": [
                    {
                        **entry.to_dict(),
                        "installed": entry.name in installed,
                        "install_path": str(services.install_path(entry.name)) if entry.name in installed else None,
                    }
                    for entry in entries
                ]
            }
        )


class InstalledView(APIView):
    def post(self, request, name: str):
        try:
            services.validate_name(name)
        except services.InvalidSkillName:
            return _bad_name()
        try:
            services.install(name)
        except services.SkillNotFound:
            return Response({"error": "not_found", "detail": f"Skill '{name}' not found upstream."}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {"name": name, "installed": True, "install_path": str(services.install_path(name))},
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, name: str):
        try:
            services.validate_name(name)
        except services.InvalidSkillName:
            return _bad_name()
        try:
            services.uninstall(name)
        except services.SkillNotFound:
            return Response(
                {"error": "not_installed", "detail": f"Skill '{name}' is not installed."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class InstallStepsView(APIView):
    def get(self, request, name: str):
        try:
            return Response(services.get_install_steps(name))
        except services.InvalidSkillName:
            return _bad_name()


def _bad_name() -> Response:
    return Response(
        {"error": "invalid_name", "detail": "Skill name must match [a-z0-9_-]+."},
        status=status.HTTP_400_BAD_REQUEST,
    )
