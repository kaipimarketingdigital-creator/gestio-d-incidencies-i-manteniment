# Vocabulari de l'equip

Extret del xat real del grup de manteniment (24 d'abril a 6 d'octubre de 2026) i
confirmat per Kaipi el 6 d'octubre de 2026. És la base del prompt de la IA.

## Senyals de prioritat

| Expressió | Significat | Efecte |
| --- | --- | --- |
| "és manteniment", "es manteniment avui", "és manteniment 3 dies" | L'habitació està ocupada i el client continua allotjat | Prioritat alta. No és una categoria |
| "avui és entrada" | Arriba un client avui a aquesta habitació | Prioritat alta |
| "no tenen aigua", "urgent" | Avaria que impedeix l'ús | Prioritat urgent |
| "no posa el cartell" | No hi ha el cartell de no molestar: es pot entrar | Informatiu |
| "productora" | Clients com els altres | Cap |

"Manteniment" té dos sentits més que no són senyal de prioritat: reparar una cosa puntual
(una incidència) i el manteniment general preventiu, com la neteja dels aires condicionats,
la piscina, els desaigües o les canaletes (una tasca periòdica).

## Tancaments

- "Fet", "Fet, ara sí", "Arreglat", "Ja està": la incidència queda resolta.
  Un "Fet" en resposta a un avís o a la confirmació del bot tanca aquella incidència.
  Un "Fet" solt obliga a preguntar quina.
- "Repassar", "Repasseu-la": resolta, i cal que pisos repassi l'habitació.

## Esperes

- "No hi ha stock", "quan arribi la canviaré", "s'ha de comprar": esperant material.
- "Parlo amb lo fuster", "vindrà Pablo", "los de l'alumini", "los dels ascensors": proveïdor extern.
- "Bloquejada": habitació que no es pot donar.

## Avisos típics

- Número d'habitació i avaria en una línia: "111 tapa solta", "Cisterna 212 perd", "Tap banyera 207".
- Només el número amb una foto: "108". La foto diu què passa.
- Dues habitacions en un missatge: "322 i 221 no obre el pany". Són dues incidències.
- Encàrrecs que no són avaries: "pujar les hamaques a la piscina", "preparar el projector". Categoria tasca.
- Preguntes i conversa ("on para l'escaleta?"): s'ignoren.

## Zones (esborrany pendent de validar amb l'hotel)

- Habitacions citades: 101 a 112, 201 a 213, 221 a 225, 301 a 313, 321 a 324, i la mini suite.
- Part nova i part vella.
- WC homes, WC dones, vestidors homes, vestidors dones.
- Cafeteria, bufet, restaurant nou, cuina, quarto fred, càmera de carn, magatzem de begudes.
- Piscina i lavabos de la piscina, sala de bicis, sala de TV, sala de màquines.
- Ascensor, passadissos i quartets de cada planta, escombraries (porta de ferro del carrer).
