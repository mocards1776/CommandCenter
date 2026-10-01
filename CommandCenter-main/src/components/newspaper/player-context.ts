import { createContext, useContext } from "react";
import { nameIndex, type NameIndex, type Person } from "@/lib/newspaper-people";

export const PlayerPopContext = createContext<(person: Person) => void>(() => {});

export const PeopleContext = createContext<NameIndex>(nameIndex([]));

export function usePlayerPop() {
  return useContext(PlayerPopContext);
}

export function usePeople() {
  return useContext(PeopleContext);
}
