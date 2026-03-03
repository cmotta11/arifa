from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ApplicationError(Exception):
    def __init__(self, message: str, extra: dict | None = None):
        super().__init__(message)
        self.message = message
        self.extra = extra or {}


def custom_exception_handler(exc, context):
    if isinstance(exc, ApplicationError):
        data = {"message": exc.message, "extra": exc.extra}
        return Response(data, status=status.HTTP_400_BAD_REQUEST)

    response = exception_handler(exc, context)
    return response
