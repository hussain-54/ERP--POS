import { Input, type InputProps } from "./Input.js";

export function DatePicker(props: Omit<InputProps, "type">) {
  return <Input type="date" {...props} />;
}
