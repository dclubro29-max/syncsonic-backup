import React, { createContext, useContext } from "react";

const RepeatLockContext = createContext(null);

/**
 * Repetarea este o simplă stare a deckului. Gazda păstrează întotdeauna
 * Pauză și Oprește; nu există parolă, numărătoare sau blocare restaurată.
 */
export function RepeatLockProvider({ children }) {
  return (
    <RepeatLockContext.Provider
      value={{
        guardDeck: (_, action) => action(),
        guardAll: (action) => action(),
      }}
    >
      {children}
    </RepeatLockContext.Provider>
  );
}

export function useRepeatGuard() {
  const ctx = useContext(RepeatLockContext);
  return ctx || { guardDeck: (_, action) => action(), guardAll: (action) => action() };
}