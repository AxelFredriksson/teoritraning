# Teoriträning för tentaplugg – design

*Datum: 2026-10-24 · Status: utkast för godkännande*

## Syfte och varför

Axel läser Teknisk fysik. Kurserna innehåller mycket teori (definitioner, satser, villkor) som förväntas kunnas och tillämpas, men tentaplugg sker främst på gamla tentor. Teori som sällan förekommer på tentor riskerar då att aldrig repeteras.

Konkret exempel (TATA77, Fourieranalys): en tentauppgift krävde startvärdessatsen, som Axel inte kunde. Hade den inte dykt upp på en gammal tenta hade han aldrig vetat att den fanns – och missat den på den riktiga tentan. Ett annat återkommande problem: att veta vilken sats som ska användas, men inte minnas vilka villkor som måste gälla för att den får tillämpas.

Verktyget ska vara ett lättsamt komplement till vanligt tentaplugg: något man kan köra en kväll eller medan man äter, vid datorn eller i mobilen, och avbryta när som helst.

## Mål

Frågorna ska träna fyra saker:

1. **Innehåll** – "Vad säger startvärdessatsen?", "Definiera testfunktionsrummet D(R)."
2. **Villkor** – vad som måste gälla för att en sats får tillämpas.
3. **Igenkänning** – i en given situation/uppgift, vilken sats eller vilket begrepp är verktyget?
4. **Täckning** – den teori som *sällan* förekommer på tentor ska inte drunkna; den ska lyftas fram snarare än nedprioriteras.

Övriga mål:

- Fria pass: ingen fast längd, 15 min till 2 h, inget går förlorat om man slutar mitt i.
- Fungerar på dator (huvudläge), iPad (handskrift med penna) och iPhone (lättare variant).
- Framsteg synkas mellan alla enheter.
- Spelkänsla: poäng, daglig streak, översikt över vad man "har" per kurs.
- Genomtänkt visuell design, framtagen som ett eget steg.
- På sikt: genereringen av frågebanker paketeras som en Claude Code-skill som kan köras mot nya kurser.

## Icke-mål

- Ersätta räkneträning på gamla tentor. Verktyget tränar teori, inte långa räknelösningar.
- Native iOS-app i första läget (se Begränsningar).
- Öppen tjänst för allmänheten. Inga självregistreringar.
- Offline-läge.

## Anti-mål (vad som vore ett misslyckande även om det tekniskt fungerar)

- Att någon obehörig kommer åt rättningsfunktionen och drar API-kostnader.
- Att frågebanken innehåller felaktig teori som Axel lär sig. Därför kontrolleras varje kort mot källmaterialet och visar sin källa, och fel kan rapporteras direkt.
- Att verktyget känns som ett pass som måste "betas av" – det ska vara lätt att plocka upp och lägga ner.

## Begränsningar

- Axel utvecklar på Windows och har ingen Mac. En riktig iOS-app är därför uteslutet tills vidare.
- Månadstak för Claude-API: **50 kr**, satt som hård gräns i Anthropic-konsolen.
- Kursmaterialet ligger lokalt i `<kursmapp>\<KURS>\`. För TATA77 finns kompendiet som både PDF och Markdown (`Kurshemsida/fakomp.md`, Aigner 2026, ~220 hänvisningar till satser/definitioner), föreläsningar `fo01–fo12.pdf`, lektionslösningar och tentor med svar 2023–2026 (`Material/Tentor/`). TAMS24 har liknande struktur.
- Matten är tung: integraler, summor, gränsvärden, distributioner. Formler måste kunna visas snyggt och matas in rimligt.

## Beslut (fattade i samtalet)

### Två delar, byggs i denna ordning

1. **Spelappen** med en handgjord frågebank för TATA77, för att känna efter om upplägget fungerar. Axel vill att den ska vara användbar inför TATA77-tentan **2026-10-27**. Det är ett snävt tidsfönster, så byggordningen ska ge något användbart tidigt: frågebanken och övningsloopen först, finputs därefter.
2. **Generatorn** som Claude Code-skill, paketerad *efter* att frågeformatet bevisat sig.

Det visuella designsteget görs före byggandet av appens gränssnitt: skisser som Axel reagerar på innan något byggs.

### Plattform

- **Webbapp som läggs på hemskärmen (PWA).** Öppnas i helskärm, fungerar på dator, iPad och iPhone. Kan göras om till native senare om det visar sig nödvändigt.

### Svarssätt

Beroende på fråga:

- **Flerval** – snabbt, bra i mobilen, kostar inget att rätta.
- **Fritext** – egna ord (och enkel matte), rättas av AI mot en rättningsmall.
- **Handskrift** – rita med Apple Pencil direkt i appen på iPaden; bilden skickas till AI som tolkar och bedömer mot rättningsmallen.

### Frågor genereras och kontrolleras automatiskt

Frågor skapas automatiskt ur kursmaterial och tentor. Axel ska **inte** behöva granska varje fråga. I stället kontrolleras varje kort av ett separat AI-steg mot källmaterialet (kompendium, föreläsningar, tentalösningar):

- Kontrollen ska peka ut den källa kortet bygger på (t.ex. "sats 2.17, s. 23 i fakomp") och bekräfta att påståendet, villkoren och referenssvaret stämmer med den.
- Kort som klarar kontrollen godkänns automatiskt och visar sin källhänvisning i appen.
- Kort som inte klarar den, eller där källan är oklar, hamnar i en granskningskö för Axel.
- Varje kort har en knapp för att **rapportera fel** under övning. Rapporterade kort tas ur rotationen och läggs i granskningskön.

### Korttyp: hitta felet

En uppgift visas tillsammans med en lösning som innehåller ett inplanterat fel. Axels uppgift är att hitta felet och säga vad som är fel, inte att lösa uppgiften korrekt.

- Felen ska i första hand vara **teorifel**: en sats används utan att villkoren är uppfyllda, en definition tillämpas fel, eller ett steg som inte är tillåtet för distributioner. Det kopplar typen direkt till målen om innehåll och villkor.
- Uppgifter och lösningar utgår från riktiga tentauppgifter och deras lösningar, med ett fel inplanterat.
- Svaret kan ges genom att peka ut det felaktiga steget (rättas utan AI) och/eller förklara felet med egna ord (rättas av AI mot en mall som beskriver felet).
- Kortet genomgår samma automatiska kontroll. Kontrollen ska bekräfta att det finns exakt ett avsett fel och att resten av lösningen stämmer.

### Konton, synk och åtkomst

- Inloggning via konto; inloggningen sparas på enheten så man bara loggar in en gång per enhet.
- Framsteg, poäng och streaks synkas mellan enheter.
- Primärt för Axel. Kursare ska kunna **bjudas in** senare om det fungerar bra. Frågebanker delas; framsteg är per person.

### Säkerhet (i lager)

1. **Ingen kommer in:** självregistrering avstängd. Inloggning med engångslänk via e-post (inget lösenord). Tvåstegsverifiering på Axels Supabase- och Anthropic-konton.
2. **Nyckeln går inte att stjäla:** API-nycklar (Claude, Gemini) finns bara som hemligheter på serversidan, aldrig i appens kod.
3. **Rättningsfunktionen säger nej till alla utom godkända:** varje anrop kräver giltig inloggning *och* att användaren finns på en lista över godkända konton (från början bara Axel). Databasen har radnivåregler (RLS) på alla tabeller.
4. **Kostnadstak:** hård månadsgräns på 50 kr hos Anthropic. Rättningsfunktionen har dessutom egna spärrar: max antal rättningar per timme och dag per användare, maxstorlek på text och bild, och begränsad svarslängd från modellen.

### AI-rättning

- **Leverantör väljs** mellan Claude och Gemini via en växel som bara admin ser. Gemini används för test och utveckling (gratisnivå).
- **Modellnamn ligger i inställningar**, inte hårdkodat.
- Startvärden:
  - Claude, fritext: `claude-haiku-5-5`
  - Claude, handskrift: `claude-sonnet-5-5`
  - Gemini: den senaste Flash-modellen som ingår i gratisnivån för Axels projekt. Kontrolleras i AI Studio när det byggs; källorna var motstridiga.
- Notering: Google använder data som skickas på gratisnivån för produktförbättring. Godtagbart för kursmatte.

## Mina val (Claudes beslut, kan ändras)

- **Backend: Supabase**, ett **nytt, eget projekt** (Axels beslut) så att användare och inställningar inte blandas med annat. Auth med magic link, Postgres med RLS, Edge Functions för rättningen.
- **Repetitionslogik:** spridd repetition enligt Anki-principen (det man kan kommer tillbaka allt mer sällan; det man missar kommer snart). Jag föreslår algoritmen FSRS. AI-bedömningen (rätt / delvis / fel) översätts till ett betyg för schemaläggningen; Axel kan överpröva en bedömning ("jag håller inte med").
- **Fokuserade pass:** utöver "det som är dags" ska man kunna välja t.ex. "bara föreläsning 6" eller "bara sådant jag aldrig sett".
- **Varje begrepp/sats märks med tentafrekvens** (hur många gånger och vilka tentor) och källhänvisning i kompendiet (t.ex. "sats 2.17, föreläsning 2"). Sällsynta satser får extra vikt när nya kort introduceras.
- **Igenkänningsfrågor byggs på riktiga tentauppgifter** med hänvisning till vilken tenta de kommer från: "Vilken sats använder du här, och vilka villkor måste du kontrollera?"
- **Enkla vändkort med självbedömning** ("kunde / kunde inte") som extra svarssätt för mobilen. Det kostar inget att rätta.
- **Granskningskön finns i appen** i ett adminläge (godkänn / redigera / stryk), så att Axel kan hantera flaggade och rapporterade kort från vilken enhet som helst.
- **Den automatiska kontrollen körs vid generering** (i Claude-sessionen eller skillen), inte i appen. Den belastar alltså inte appens API-budget.
- **Kurser i appen:** varje kurs har egen frågebank och väljs vid start. Färdiga kurser kan arkiveras men finns kvar (omtenta).
- **Rättningsspärrar (startvärden):** 60 rättningar/timme, 300/dag per användare; varav handskrift (Sonnet) max 40/dag så att en intensiv kväll inte ensam kan äta upp månadstaket. Bild max ~1,5 MB efter komprimering; fritext max ~4 000 tecken.
- **Matte visas med KaTeX**; frågebanken lagrar matte som LaTeX.
- **Begrepp och kort:** varje sats/definition är ett *begrepp* med flera *kort* (innehåll, villkor, igenkänning). Schemaläggningen sker per kort; resultaten rullas upp till begreppet för översikten och för viktningen av sällsynt teori.
- **Svarssätt per kort och enhet:** varje kort har ett huvudsvarssätt (flerval eller öppet svar). Öppna kort har en rättningsmall och ett referenssvar och kan besvaras med fritext *eller* handskrift (samma mall). Alla kort kan också köras som vändkort med självbedömning – det är så mobilen kör öppna kort, och det är reservläget när AI-rättning inte är tillgänglig.
- **När AI-budgeten tar slut:** appen loggar uppskattad kostnad per rättning och visar månadens förbrukning för admin. Misslyckas rättningen (tak nått, spärr, fel) faller kortet tillbaka till självbedömning med referenssvaret. Byte till Gemini sker manuellt av admin, inget automatiskt byte. Budget för inbjudna kursare tas upp när det blir aktuellt.
- **Matte i fritext:** skrivs som enkel LaTeX/klartext med förhandsvisning via KaTeX medan man skriver. Formeltungt besvaras hellre med handskrift.
- **Frågebanken för del 1** genereras av Claude i en vanlig session ur kompendiet (`fakomp.md`), föreläsningarna och tentorna – samma arbetssätt som skillen senare paketerar – Den kontrolleras automatiskt mot källorna, och bara flaggade kort hamnar i appens granskningskö. Granskningskön och knappen för att rapportera fel ingår alltså redan i del 1.

## Kvar för byggaren att avgöra

- Frontend-ramverk och byggverktyg, hosting av den statiska appen.
- Exakt datamodell och frågebanksformat (det ska vara ett format som generator-skillen senare kan producera och som är lätt för Axel att granska).
- Ritytan för handskrift (bibliotek eller egen implementation) och bildkomprimering.
- Exakt prompt och rättningsmallens struktur. Rättningen ska ge strukturerat svar: bedömning, kort återkoppling och vilka delar som saknades.
- Poängsystem, streak-regler och översiktens utformning tas fram i designsteget med Axel.
- Hur kursare bjuds in rent praktiskt (fas efter första versionen).
- Generatorn: hur kursmaterial (PDF/Markdown) och tentor läses in, hur tentafrekvens räknas fram, och hur skillen levererar till appens granskningskö.

## Öppna risker att testa tidigt

- **Handskriftsrättningens kvalitet** med Axels egen handstil och tung matte. Bör testas med ett litet prov innan mycket byggs ovanpå.
- **Haiku 5.5:s rättningskvalitet** för fritext. Om den missar saker flyttas fritext till Sonnet 5.5.
