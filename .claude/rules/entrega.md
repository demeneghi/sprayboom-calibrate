# Entrega: pull request siempre, merge nunca

Esta aplicación calcula calibraciones agrícolas y se usa en campo desde el teléfono. Un cambio
que entra sin que una persona lo revise puede llegar al lote el mismo día. Por eso la entrega
tiene dos reglas duras, y ninguna admite excepción.

## 1. Siempre se abre un pull request — REGLA DURA

- **Todo cambio se entrega en una rama y un pull request.** Nunca se hace `push` a la rama por
  defecto (`main`), ni siquiera para un ajuste de una línea, ni para arreglar CI.
- Al terminar el trabajo: se hace commit, se hace push a la rama de trabajo y **se abre el pull
  request**. No hay que esperar a que lo pidan: entregar es abrir el PR.
- Si la rama **ya tiene un pull request abierto**, se sigue usando ese; no se abre un segundo.
- Si el pull request de la rama **ya fue mergeado**, el trabajo de seguimiento arranca de nuevo:
  rama desde el último `main` y **pull request nuevo**. Un PR mergeado está cerrado para siempre.
- Si el repositorio trae plantilla de PR (`.github/pull_request_template.md` o equivalente), se
  llena con sus mismas secciones.
- El cuerpo del PR dice **qué cambió y por qué**, y **el resultado de las compuertas**: `npm test`,
  contraste, precache, `acentuar`, `humo` e `interaccion`. Si alguna no se pudo correr, se dice
  cuál y por qué.

## 2. NUNCA se hace merge — REGLA DURA

- **Prohibido integrar el pull request**: nada de `merge`, `squash and merge`, `rebase and merge`,
  `auto-merge`, ni `merge` local a `main` seguido de push. Decidir si un cálculo agrícola entra a
  producción es de una persona, no del agente.
- Tampoco se **cierra** un pull request ajeno ni se borra su rama.
- Lo que sí se hace dentro del PR: subir commits nuevos, responder revisiones, arreglar CI en
  rojo y **traer `main` a la rama** cuando hay conflicto o cuando la base se arregló (eso es
  actualizar la rama, no integrar el PR).
- Si el trabajo parece urgente, la respuesta sigue siendo la misma: se avisa en el PR y se espera.
