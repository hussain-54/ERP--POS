import { Input, type InputProps } from "./Input.js";

export function SearchInput(props: Omit<InputProps, "type">) {
  return <Input type="search" placeholder={props.placeholder ?? "Search…"} {...props} />;
}
