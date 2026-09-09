import { Alert } from "./ui/alert";

interface FormAlertProps {
  message?: string;
  success?: boolean;
  role?: "alert" | "status";
}

export function FormAlert({ message, success = false, role = "alert" }: FormAlertProps) {
  return (
    <Alert className="mt-5 border-l-[3px] px-4 py-3 text-xs leading-5" variant={success ? "success" : "destructive"} role={role} hidden={!message}>
      {message}
    </Alert>
  );
}
