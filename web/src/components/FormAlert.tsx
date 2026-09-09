interface FormAlertProps {
  message?: string;
  success?: boolean;
  role?: "alert" | "status";
}

export function FormAlert({ message, success = false, role = "alert" }: FormAlertProps) {
  return (
    <div className={`form-alert${success ? " success" : ""}`} role={role} hidden={!message}>
      {message}
    </div>
  );
}
