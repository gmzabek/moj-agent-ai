# Integracja zabezpieczeń

Plik `security.js` udostępnia gotowy przepływ `runProtectedChat`. Wywołaj go
wewnątrz serwerowego endpointu zamiast bezpośrednio wywoływać model:

```js
import { runProtectedChat } from "./security.js";

const result = await runProtectedChat({
  // Identyfikator musi pochodzić z uwierzytelnionej sesji po stronie serwera.
  userId: session.user.id,
  input: body.message,
  generate: (safeInput) => callYourLlm(safeInput),
  protectedFragments: [
    // Charakterystyczne, poufne fragmenty instrukcji systemowej.
    process.env.SYSTEM_PROMPT_MARKER,
  ],
});

return Response.json(result, { status: result.status });
```

Pierwszych 50 wiadomości użytkownika w ciągu przesuwnej godziny jest
dopuszczanych. Wiadomość numer 51 otrzyma status `429` i czas oczekiwania.

Domyślny limiter działa w pamięci pojedynczego procesu. W produkcji z wieloma
instancjami lub funkcjami serverless należy użyć współdzielonego, atomowego
magazynu (np. Supabase albo Redis), inaczej każda instancja będzie miała osobny
licznik. Nie należy przyjmować `userId` z request body, bo użytkownik mógłby
podszyć się pod inną osobę albo obchodzić limit.
