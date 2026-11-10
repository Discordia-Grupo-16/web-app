# Cliente realtime (@discordia/api)

Cliente WebSocket para la mensajería en tiempo real de `chat-and-real-time`, escrito como
módulo TypeScript plano sin dependencias de React ni del DOM. Lo pensado para ser reusado
tal cual desde `apps/web` (Vite) y, más adelante, desde `apps/mobile` (React Native).

## Uso

```typescript
import { createRealtimeClient, createWsTicketGetter } from '@discordia/api';

const client = createRealtimeClient({
    url: 'ws://localhost:8080/api/v1/ws',
    getTicket: createWsTicketGetter(apiClient),
});

const off = client.on('messageCreated', (frame) => { /* ... */ });
client.connect();
client.sendMessage({ channelId, content, clientMessageId: crypto.randomUUID() });
// ...
off();
client.disconnect();
```

(`crypto.randomUUID()` aparece solo en el ejemplo: generar el `clientMessageId` le toca a quien
llama. En React Native hay que buscar otra fuente de UUID.)

## Cómo viaja la credencial: ticket de un solo uso

La API `WebSocket` del navegador no permite mandar headers en el handshake, así que la credencial
viaja como query param: `<url>?ticket=<ticket urlencoded>`. Ya **no** se manda el JWT en la URL
(ADR-0008): el ticket lo emite el gateway (`POST /api/v1/ws-ticket`), vive 30 segundos y se canjea
una sola vez, así que si queda en un log no sirve para nada.

`getTicket()` se llama **en cada intento de conexión**, incluidas las reconexiones, porque cada
ticket sirve una vez. `createWsTicketGetter(apiClient)` lo pide con la misma instancia de axios
que el resto de la app, por lo que si el access token venció se renueva antes de pedir el ticket.
Si el pedido da `401` (no hay sesión usable) devuelve `null` y el cliente pasa a `closed` sin
reintentar; cualquier otro error hace que reintente con backoff.

Un 401/403 en el handshake **no se puede distinguir desde JS** de una caída de red — el
navegador solo entrega un `close` con código 1006 sin status HTTP. El cliente trata ambos casos
igual y reintenta con backoff. Distinguir "token inválido" de "red caída" queda como deuda
conocida para CP1.

## Cierres terminales (4400–4499) y el evento `terminated`

Según `chat.yaml`, el rango **4400–4499** de close codes es **terminal**: el servidor rechazó
la conexión y reintentar no la arregla. Si el socket se cierra con un código de ese rango, el
cliente:

- pasa a `'closed'` (no a `'reconnecting'`) y **no reconecta**;
- cancela cualquier reconexión pendiente;
- emite `terminated` con `{ code, reason }`.

```typescript
import { CLOSE_ACCOUNT_SUSPENDED } from '@discordia/api';

client.on('terminated', ({ code, reason }) => {
    if (code === CLOSE_ACCOUNT_SUSPENDED) {
        // 4403 account_suspended: la app decide qué hacer (cerrar sesión, avisar al usuario).
    }
});
```

El paquete **no** desloguea ni toca tokens: no conoce la sesión, y eso lo decide cada app. Un
`connect()` posterior (por ejemplo, otro login) abre un socket nuevo sin problema, porque
`'closed'` lo permite. Cualquier otro código (1001, 1006, 1011, 4500 en adelante) sigue
reconectando con backoff como siempre.

`isTerminalCloseCode(code)` está exportado para quien necesite aplicar la misma regla.

## Dependencia externa: la ruta del gateway

La ruta correcta según el contrato es `GET /api/v1/ws` (una conexión por usuario, suscripta a
servidores). **El `api-gateway` en `develop` todavía expone otra ruta** (por canal, con un path
distinto). Hasta que se
corrija ese routing, conectar contra el stack real completo (cliente → gateway → chat) no
funciona; este paquete no depende de esa ruta en particular, solo hace falta pasarle la `url`
correcta por config.

## Qué no hace (a propósito)

- No valida contenido vacío ni el largo del mensaje: esas reglas las aplica el servidor y las
  devuelve como `ErrorFrame`, para no duplicar la fuente de verdad.
- No recupera mensajes perdidos durante una desconexión (eso es SCRUM-46, CP2).
- No reintenta un `message.send` sin ack por su cuenta: emite el evento de `ack`/`errorFrame` y
  deja la decisión de reintentar a quien lo consume.
- No implementa ping/pong a mano: usa los frames de control nativos del WebSocket.

## Tests

Todavía no hay tests automatizados: el monorepo no tiene framework de testing definido. La
lista de casos a cubrir: conexión, envío, recepción, reconexión, cierre deliberado y
suscripciones.

## Avisos de invalidación (`invalidate`)

Cuando cambia algo que el cliente tiene cargado (la lista de canales, los permisos, los
miembros...), `chat` manda un frame `invalidate` y el cliente lo entrega como el evento
`invalidate`. **El frame no trae el dato nuevo**: hay que volver a pedirlo por HTTP, porque la
fuente es `community` o `identity` (ADR-0017).

```typescript
client.on('invalidate', ({ serverId, resources, userId }) => {
    if (resources.includes('channels')) refetchChannels(serverId);
});
```

- `resources` es un conjunto abierto: un valor que no conocés se ignora, no se trata como error.
  El cliente no filtra por recurso, eso lo hace quien se suscribe.
- Un frame sin `resources` (o que no sea una lista) se descarta: no hay nada que pedir.
- Los avisos que pasan mientras el socket está caído se pierden. Quien escucha tiene que volver
  a pedir todo al reconectar; `onReconnect` de `@discordia/core` avisa cuándo.
