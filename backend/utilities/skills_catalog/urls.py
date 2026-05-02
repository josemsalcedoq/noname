from django.urls import path

from .views import CatalogView, InstalledView, InstallStepsView

urlpatterns = [
    path("catalog", CatalogView.as_view(), name="skills-catalog"),
    path("installed/<str:name>", InstalledView.as_view(), name="skills-installed"),
    path("install-steps/<str:name>", InstallStepsView.as_view(), name="skills-install-steps"),
]
