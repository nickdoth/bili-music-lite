import React from "react"

export const linkChangeState = <E extends { value: string }>(dispatch: React.Dispatch<React.SetStateAction<string>>) => {
  return (ev: React.ChangeEvent<E>) => {
    dispatch(ev.target.value);
  };
}