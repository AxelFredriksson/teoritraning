# Del 2: Kursbank-generatorn och räknekort – design

*Datum: 2026-11-02 · Status: utkast för godkännande · Bygger på `2026-10-24-teoritranare-design.md` (del 1)*

## Syfte och varför

Del 1 bevisade upplägget: Teoriträning (https://teoritraning.vercel.app) används på iPad med en handgjord TATA77-bank (155 begrepp, 380 kort). Banken togs fram i en vanlig Claude-session: generera ur kompendium, föreläsningar och tentor, kontrollera varje kort mot källorna, flagga det osäkra. Del 2 paketerar det arbetssättet så att det kan köras mot nya kurser – och mot samma kurs igen när nytt material kommer.

Första kursen är **TPPE29 Finansiella marknader och instrument** (tenta januari 2027). Den skiljer sig från TATA77 på tre sätt som formar designen:

1. **Kursen pågår.** Axel vill öva kontinuerligt, föreläsning för föreläsning, fram till tentan. Föreläsningsmaterial läggs upp efter hand och vissa saknas (Henningssons Fö 2–3 och 8–10). Banken måste därför kunna **byggas på** stegvis.
2. **Axel saknar ekonomibakgrund.** Grundbegreppen behöver ses flera gånger och helst användas i ett sammanhang för att fastna (Axels ord: "jag behöver bara se det några gånger", "lättare ifall man lär sig använda det i något sammanhang").
3. **Tentan är ungefär hälften räkning** (binomialträd, obligationspriser, dagräkningskonventioner, duration, minimal-varians-portfölj) och hälften teori ("förklara kortfattat", "beskriv hur en ränteswap fungerar", resonemang om banker och Basel). Axel vill öva **båda**, även kortare räknemoment i appen.

## Mål

- En Claude Code-skill som tar en kursmapp och producerar/uppdaterar en frågebank i appens format, kontrollerar den mot källorna och laddar upp den automatiskt.
- **Stegvis påbyggnad:** en ny körning lägger till begrepp och kort ur nytt material, utan dubbletter, utan att röra Axels framsteg.
- **Ny korttyp: räknekort** i appen – kort uppgift, numeriskt slutsvar som kontrolleras lokalt, därefter lösning steg för steg och möjlighet till AI-felsökning av handskriven uträkning.
- Kortmix för en teoritung kurs utan förkunskaper: begreppskort, sammanhangskort, räknekort, resonemangskort (se nedan).
- Skillen är generell (fungerar för andra kurser), men TPPE29 är det som byggs och testas mot.

## Icke-mål

- Långa räknelösningar i appen (hela treperiodiga binomialträd). Stora tentauppgifter bryts ner i korta moment.
- Inbjudan av kursare (egen fas, oförändrat från del 1).
- Att hämta material från nätet eller bakom inloggning. Axel lägger själv material i kursmappen.
- Att granska varje kort manuellt. Bara flaggade kort hamnar i granskningskön (som i del 1).

## Anti-mål

- **Att korten innehåller felaktig teori som Axel lär sig.** Axels uttalade värsta fall. Styr källhierarkin och kontrollsteget nedan.
- Att en ny körning förstör framsteg: tar bort kort Axel övat på, nollställer deras schema, eller skapar dubbletter av begrepp han redan kan.
- Att en körning kräver manuellt pyssel (klistra SQL i SQL Editor, som i del 1).

## Begränsningar

- Kursmaterial ligger lokalt i `<kursmapp>\<KURS>\`. För TPPE29:
  - `kursrum-lisam/Kurspresentation2026.pdf` – föreläsningsplan (11 föreläsningar, ämnen, föreläsare), betygsgränser.
  - `kursrum-lisam/Föreläsningar/fo1, fo4, fo5, fo6, fo7, fo11.pdf` + `laboration.pdf`. Fö 5 och labben är Excel/VBA, nästan ingen teori.
  - `kursrum-lisam/faktakunskaper.xlsx` – 414 nyckelord med definitioner, kolumner: nr, förkunskap (TPPE17/Gymnasiet/tom), Föreläsning (Fö1–Fö11), Nyckelord, Definition. Täcker alla teoriföreläsningar, även de som saknas som PDF.
  - `Tentor/*.zip` – sju tentor 2022–2025, var och en med `_EXAM.pdf` och `_SOLUTION.pdf`. 4 uppgifter à 10 p.
  - `inlasning/` – sju inläsningsdokument (PDF + LaTeX-källa) som **Claude har tagit fram**. Lägre tillförlitlighet, se källhierarkin.
- PDF-text extraheras med `pdftotext` (finns i Git Bash) och Excel med Python/openpyxl. Arkiv packas upp i en egen tom katalog (otillförlitliga data).
- Ingen git-remote; Vercel-deploy körs manuellt (`npx --no-install vercel --prod --yes`).
- Månadstak 50 kr för Claude-API i appen. Generering och kontroll sker i Claude Code-sessionen och belastar inte appens API-budget. Räknekortens slutsvar kontrolleras lokalt, utan API-anrop.
- Filer i repot har CRLF-radslut; behåll det.

## Beslut

### Källhierarki (Axels beslut: "lita mindre på" inläsningsmaterialet)

- **Belägg** (ett kort får bara bli aktivt om det kan beläggas här): föreläsningar, tentor med lösningar, faktakunskapslistan, kursinformationen.
- **Hjälpmaterial:** `inlasning/` får användas för att hitta begrepp och formulera pedagogiska förklaringar, men räknas aldrig som belägg. Kort som bara kan beläggas där laddas upp som `flagged`.
- Ämnen utan föreläsning (TPPE29: Henningssons) beläggs med tentalösningar och faktakunskapslistan där det går, annars flaggas. När föreläsningen sedan läggs till kontrollerar nästa körning om de flaggade korten och kan släppa dem.
- Varje kort visar sin källa (oförändrat).

### Kortmix

- **Begreppskort:** definitionen själv ("Vad är en FRA?"). Grundas i faktakunskapslistan och föreläsningarna.
- **Sammanhangskort:** begreppet i en situation, gärna från tentauppgifter ("En bank vill låsa räntan på ett lån som startar om tre månader – vilket instrument och hur?"). *Claudes beslut:* begrepp får ett sammanhangs- eller räknekort **där belägg-källorna ger underlag** för en situation (tentauppgift, föreläsningsexempel). Det tvingas inte fram för varje begrepp – ett påhittat sammanhang utan belägg är just den sortens kort som riskerar fel teori. Sammanfattningen visar hur många begrepp som bara har definitionskort.
- **Begreppens ryggrad (Claudes beslut):** faktakunskapslistans rader är grunden för begreppen i TPPE29 – alla 414, även förkunskaperna (TPPE17/Gymnasiet, nivå 1), eftersom Axel saknar ekonomibakgrund och kan välja bort nivå 1 i appen. Närliggande rader får slås ihop till ett begrepp; föreläsningar och tentor kan tillföra begrepp som saknas i listan. Begreppens id bygger inte på listans löpnummer (listan kan ändras), men vilket listnummer ett begrepp täcker sparas, så att dubbletter kan upptäckas vid omkörning.
- **Räknekort:** se nedan.
- **Resonemangskort:** tentans diskussionsfrågor (Basel-pelarna, bankens risk i bostadsrättslån). Öppet svar, AI-rättat med mall, som befintliga öppna kort.
- Befintliga korttyper (innehåll, villkor, igenkänning, hitta felet) och svarssätt (flerval, öppet, vändkort) återanvänds där de passar.
- Tentafrekvens räknas per begrepp över tentorna som i del 1 (sällsynta lyfts fram). Nivåer 1–3 sätts som i del 1. Begrepp markerade som förkunskap (TPPE17/Gymnasiet) i faktakunskapslistan blir nivå 1.

### Räknekort (ny korttyp i appen – Axel bekräftade flödet)

1. Kortet visar en kort uppgift i tentastil, ett eller några få steg. Ex: "Beräkna effektiv ränta från likviddag 16 jan till 9 jun, enkel årsränta 3,5 %, svensk dagräkningskonvention."
2. Axel räknar med miniräknare och penna – i appen med handskrift på iPad, eller på papper.
3. Axel skriver in **slutsvaret som ett tal**. Appen kontrollerar mot facit med tolerans, lokalt, utan API-anrop.
4. Lösningen visas steg för steg. Vid fel kan Axel skicka sin handskrivna uträkning till AI:n som pekar ut var det gick snett (återanvänder handskriftsrättningen och dess spärrar).
- Stora tentauppgifter bryts ner i flera kort (t.ex. u/d/riskneutral sannolikhet; ett bakåtsteg i trädet; hur utdelningen ändrar trädet).
- **Facit beräknas på två sätt** vid generering – ett litet skript och ett resonerat svar – och de måste stämma, annars flaggas kortet.
- Rätt/fel på slutsvaret översätts till betyg för schemaläggningen som övriga kort. Vändkort/självbedömning som reserv fungerar även för räknekort.

### Första körningen och vad "nytt" betyder (Axels beslut: "hela kursen direkt, jag styr med föreläsningsknapparna")

- Första körningen bygger kort för **hela kursen** med det material som finns – alla föreläsningar i faktakunskapslistan, inklusive de som ännu inte förelästs. Axel styr själv vad han övar via föreläsningsknapparna (F1, F2, …). Ingen "upp till föreläsning N"-parameter behövs.
- "Nytt sedan förra körningen" betyder **nya eller ändrade källfiler** (manifest). En ny källfil kan ge nya kort, och den kan också ge belägg för kort som tidigare flaggats – de kontrolleras då om.

### En körning (Axels beslut: "kör skillen, visa en sammanfattning, sen laddas korten upp automatiskt")

1. Axel lägger nytt material i kursmappen och kör skillen i Claude Code (t.ex. `/kursbank TPPE29`).
2. Skillen avgör vad som är nytt sedan förra körningen. *Claudes förslag:* ett manifest per kurs med vilka källfiler (och hash) som redan bearbetats.
3. Begrepp och kort genereras ur det nya, kopplas till befintliga begrepp i stället för att dubbleras, och tentafrekvensen räknas om om nya tentor tillkommit. Flaggade kort kontrolleras om när ny belägg-källa tillkommit.
4. Varje nytt eller ändrat kort kontrolleras mot belägg-källorna av ett separat kontrollsteg (som i del 1). Underkända eller oklara → `flagged` med anteckning → granskningskön.
5. **Sammanfattning** i terminalen: nya begrepp och kort per föreläsning och typ, antal flaggade och varför, ändrade befintliga kort.
6. **Automatisk uppladdning** till Supabase, utan SQL Editor. *Claudes förslag:* ett skript som använder en servicenyckel som Axel lägger i en lokal, git-ignorerad fil.

Ingen bekräftelse krävs mellan steg 5 och 6.

### Skydd av framsteg (Claudes förslag, Axel: "stämmer bra")

- Stabila kort- och begrepps-id:n mellan körningar.
- Rättas ett befintligt kort behålls dess repetitionshistorik.
- Kort tas aldrig bort, de stängs av.
- *Upptäckt i koden:* dagens uppladdning skriver över `status` för alla kort utom `rejected`, och ett godkänt kort går inte att skilja från ett som var aktivt från början. Ett granskningsbeslut måste därför sparas så att uppladdningen kan respektera det.
- **Regler vid omkörning (Claudes beslut, åt det säkra hållet med tanke på anti-målet):**
  - Ett kort som inte ändrats rörs inte – varken status eller innehåll. Ett godkänt kort flaggas aldrig om bara för att körningen kontrollerar det igen.
  - Ett godkänt kort som skrivs om och vars nya version underkänns går tillbaka till granskningskön (det är ju ny text Axel inte godkänt).
  - Ett kort Axel rapporterat eller avvisat och som en körning rättar blir inte aktivt automatiskt; det stannar i kön med en anteckning om vad som ändrats, och Axel avgör.

### TATA77 (Claudes beslut)

TATA77-tentan var 2026-10-27. Den befintliga banken (`bank/tata77.json` med handgjorda mellanfiler) lämnas orörd och tas inte över av skillen. Skillen är för nya kurser; TATA77 kan importeras senare om det behövs.

### Radslut (Claudes beslut)

Befintliga källfiler behåller sitt radslut (de flesta i `src/` och `tests/` är CRLF). Nya filer, inklusive genererade bankfiler, skrivs med LF.

### Övning per föreläsning

Finns redan: startskärmens knappar F1, F2, … startar pass för en föreläsning; översikten grupperar per föreläsning; återställning per föreläsning byggdes 2026-11-02 (commit `dfa95b0`). Nya föreläsningars knappar dyker upp automatiskt när deras kort laddas upp. Inget nytt behövs här.

## Lämnas till byggaren

- Exakt datamodell för räknekort (fält för facit, tolerans, enhet, lösningssteg) och hur den ryms i bank-schemat (`src/bank/schema.ts`) och `cards`-tabellen.
- Hur toleransen sätts (absolut/relativ, avrundning i tentastil).
- Om begreppskategorierna (`sats`, `definition`, `metod`, `begrepp`) behöver utökas för ekonomi.
- Skillens namn och placering, struktur för mellanfiler (motsvarande `bank/parts`, `bank/verify`, `bank/meta`) per kurs, och hur id:n görs stabila.
- Hur dubbletter av begrepp upptäcks mellan körningar.
- Hur ett nytt kursobjekt (`courses`) skapas och görs synligt i kursväljaren.
- Hur avstängning av kort representeras (befintlig `rejected` eller ny status).
- Hur skillen bryts upp i agenter (generering, kontroll, titlar/nivåer) och hur många kort per körning.
