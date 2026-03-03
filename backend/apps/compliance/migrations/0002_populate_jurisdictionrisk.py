"""Data migration to seed JurisdictionRisk with country risk weights.

Risk weights follow FATF and regional risk assessments:
  1-2: Low risk (OECD/EU nations with strong AML frameworks)
  3-4: Medium-low risk (stable countries with adequate AML)
  5-6: Medium risk (developing nations with emerging AML)
  7-8: High risk (FATF grey list, weak AML)
  9-10: Very high risk (FATF black list, sanctioned, conflict zones)
"""

from django.db import migrations


JURISDICTION_DATA = [
    # --- Very High Risk (9-10) - FATF black list / heavily sanctioned ---
    ("PRK", "North Korea", 10),
    ("IRN", "Iran", 10),
    ("MMR", "Myanmar", 9),
    ("SYR", "Syria", 9),
    ("AFG", "Afghanistan", 9),
    ("YEM", "Yemen", 9),
    ("LBY", "Libya", 9),
    ("SOM", "Somalia", 9),
    # --- High Risk (7-8) - FATF grey list / weak AML ---
    ("RUS", "Russia", 8),
    ("VEN", "Venezuela", 8),
    ("CUB", "Cuba", 8),
    ("SDN", "Sudan", 8),
    ("SSD", "South Sudan", 8),
    ("NGA", "Nigeria", 7),
    ("PAK", "Pakistan", 7),
    ("HTI", "Haiti", 7),
    ("CMR", "Cameroon", 7),
    ("TZA", "Tanzania", 7),
    ("MOZ", "Mozambique", 7),
    ("COD", "Democratic Republic of the Congo", 7),
    ("MNG", "Mongolia", 7),
    ("VNM", "Vietnam", 7),
    ("KEN", "Kenya", 7),
    # --- Medium Risk (5-6) - developing / emerging AML ---
    ("PAN", "Panama", 6),
    ("BLZ", "Belize", 6),
    ("VGB", "British Virgin Islands", 6),
    ("CYM", "Cayman Islands", 5),
    ("BMU", "Bermuda", 5),
    ("BHS", "Bahamas", 5),
    ("LBN", "Lebanon", 6),
    ("JOR", "Jordan", 5),
    ("PHL", "Philippines", 6),
    ("THA", "Thailand", 5),
    ("IDN", "Indonesia", 5),
    ("IND", "India", 5),
    ("ZAF", "South Africa", 6),
    ("TUR", "Turkey", 6),
    ("CHN", "China", 5),
    ("HKG", "Hong Kong", 5),
    ("SAU", "Saudi Arabia", 5),
    ("ARE", "United Arab Emirates", 5),
    ("QAT", "Qatar", 5),
    ("BHR", "Bahrain", 5),
    ("KWT", "Kuwait", 5),
    ("OMN", "Oman", 5),
    ("EGY", "Egypt", 6),
    ("MAR", "Morocco", 5),
    ("DZA", "Algeria", 6),
    ("TUN", "Tunisia", 5),
    ("SEN", "Senegal", 5),
    ("GHA", "Ghana", 5),
    ("UGA", "Uganda", 6),
    ("RWA", "Rwanda", 5),
    ("ETH", "Ethiopia", 6),
    ("AGO", "Angola", 6),
    ("CRI", "Costa Rica", 4),
    ("GTM", "Guatemala", 6),
    ("HND", "Honduras", 6),
    ("NIC", "Nicaragua", 6),
    ("SLV", "El Salvador", 5),
    ("DOM", "Dominican Republic", 5),
    ("JAM", "Jamaica", 5),
    ("TTO", "Trinidad and Tobago", 5),
    ("PRY", "Paraguay", 6),
    ("BOL", "Bolivia", 5),
    ("ECU", "Ecuador", 5),
    ("PER", "Peru", 5),
    ("COL", "Colombia", 5),
    # --- Medium-Low Risk (3-4) - adequate AML ---
    ("BRA", "Brazil", 4),
    ("MEX", "Mexico", 4),
    ("ARG", "Argentina", 4),
    ("CHL", "Chile", 3),
    ("URY", "Uruguay", 3),
    ("ISR", "Israel", 3),
    ("GRC", "Greece", 3),
    ("CYP", "Cyprus", 4),
    ("MLT", "Malta", 4),
    ("BGR", "Bulgaria", 4),
    ("ROU", "Romania", 4),
    ("HRV", "Croatia", 3),
    ("SRB", "Serbia", 4),
    ("MNE", "Montenegro", 4),
    ("GEO", "Georgia", 4),
    ("UKR", "Ukraine", 4),
    ("KAZ", "Kazakhstan", 4),
    ("MYS", "Malaysia", 3),
    ("SGP", "Singapore", 3),
    ("KOR", "South Korea", 3),
    ("TWN", "Taiwan", 3),
    ("JPN", "Japan", 2),
    ("MUS", "Mauritius", 4),
    ("SCG", "Seychelles", 4),
    # --- Low Risk (1-2) - OECD / strong AML frameworks ---
    ("USA", "United States", 2),
    ("GBR", "United Kingdom", 2),
    ("CAN", "Canada", 2),
    ("AUS", "Australia", 2),
    ("NZL", "New Zealand", 1),
    ("DEU", "Germany", 1),
    ("FRA", "France", 2),
    ("ITA", "Italy", 2),
    ("ESP", "Spain", 2),
    ("PRT", "Portugal", 2),
    ("NLD", "Netherlands", 1),
    ("BEL", "Belgium", 2),
    ("LUX", "Luxembourg", 2),
    ("AUT", "Austria", 1),
    ("CHE", "Switzerland", 2),
    ("IRL", "Ireland", 2),
    ("DNK", "Denmark", 1),
    ("SWE", "Sweden", 1),
    ("NOR", "Norway", 1),
    ("FIN", "Finland", 1),
    ("ISL", "Iceland", 1),
    ("POL", "Poland", 2),
    ("CZE", "Czech Republic", 2),
    ("SVK", "Slovakia", 2),
    ("SVN", "Slovenia", 2),
    ("HUN", "Hungary", 2),
    ("EST", "Estonia", 2),
    ("LVA", "Latvia", 2),
    ("LTU", "Lithuania", 2),
]


def populate_jurisdiction_risk(apps, schema_editor):
    JurisdictionRisk = apps.get_model("compliance", "JurisdictionRisk")
    objs = [
        JurisdictionRisk(
            country_code=code,
            country_name=name,
            risk_weight=weight,
        )
        for code, name, weight in JURISDICTION_DATA
    ]
    JurisdictionRisk.objects.bulk_create(objs, ignore_conflicts=True)


def remove_jurisdiction_risk(apps, schema_editor):
    JurisdictionRisk = apps.get_model("compliance", "JurisdictionRisk")
    codes = [code for code, _, _ in JURISDICTION_DATA]
    JurisdictionRisk.objects.filter(country_code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("compliance", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            populate_jurisdiction_risk,
            reverse_code=remove_jurisdiction_risk,
        ),
    ]
