COORDINATOR = "coordinator"
COMPLIANCE_OFFICER = "compliance_officer"
GESTORA = "gestora"
DIRECTOR = "director"
CLIENT = "client"

ROLE_CHOICES = [
    (COORDINATOR, "Coordinator"),
    (COMPLIANCE_OFFICER, "Compliance Officer"),
    (GESTORA, "Gestora"),
    (DIRECTOR, "Director"),
    (CLIENT, "Client"),
]

GUEST_LINK_EXPIRY_DAYS = 30
MAGIC_LINK_EXPIRY_MINUTES = 15
