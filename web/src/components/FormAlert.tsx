import { Alert } from "./ui/alert";

interface FormAlertProps {
  message?: string;
  success?: boolean;
  role?: "alert" | "status";
}

export function FormAlert({ message, success = false, role = "alert" }: FormAlertProps) {
  return (
    <Alert className={`form-alert${success ? " success" : ""}`} variant={success ? "success" : "destructive"} role={role} hidden={!message}>
      {message}
    </Alert>
  );
}
