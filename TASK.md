0 - Check before you collect
Before entering a building, check whether the door is meant for you.
Create a scraper/ folder in your internship repo, with a README.md , a .gitignore , and one entry file ( src/
index.js or src/main.py ).
Open toscrape.com and read what the site says about itself. Confirm with your own eyes that Books to Scrape is a
sandbox — a site built so people can practise scraping on it. That sentence on their page is your permission, and a
site like this is the only kind this assignment touches.
Request https://books.toscrape.com/robots.txt once and write down what happened. robots.txt is a
site's note to robots about where they are welcome. If the file is missing, write "no robots file found" — a missing
file is not permission, it is just a missing file.
Add a short "Target classification" section to your README: which site, why, how much (the first 3 catalogue
pages only), what data you collect, and one sentence on why that is appropriate here.
Commit: Stage 0: classify scraping target

1 - Fetch once, cache once
Before sorting the mail, prove that it arrived.
Download the first catalogue page. Send an honest user-agent that names you, such as FlyRankInternship-
A9/1.0 (+link-to-your-repo) . This is how a polite robot introduces itself — a site owner who sees it in their
logs can find out who you are.
Set a timeout. A request must give up after a few seconds — never wait forever.
Check the status code before doing anything else. Only 200 means "here is your page." Anything else is a failed
fetch, not HTML to parse.
Save the HTML to cache/catalogue-page-1.html — this saved copy is your cache. From now on, while
developing, read the saved copy instead of asking the site again. You will restart your script fifty times tonight; the
site should feel it once.
Commit: Stage 1: fetch and cache HTML

2 - Find all three pages
A crawler finds the shelves; an extractor reads the labels.
Parse the saved page with Cheerio or Beautiful Soup.
Collect the link to every book on page 1. These links are relative URLs (they look like ../book-name/
index.html ). Turn each one into an absolute URL using your language's URL tools ( new URL(href, pageUrl)
in JS, urljoin(page_url, href) in Python) — never by gluing strings together.
Follow the catalogue's own "next" link to page 2, then page 3, then stop. Let the site tell you what the pages are
— do not hardcode sixty book links.
Wait at least half a second between real requests to the site. Cached pages need no delay — they never leave
your computer.
Remove duplicate links before the next stage.
Commit: Stage 2: discover three catalogue pages

3 - Extract the raw records
Now open each book — and keep the receipt.
For every book page, collect this raw record:
{
"title": "A Light in the Attic",
"product_url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/
index.html",
"price_text": "£51.77",
"availability_text": "In stock (22 available)",
"rating_text": "Three",
"description": "...",
"source_page": "https://books.toscrape.com/catalogue/page-1.html",
"fetched_at": "2026-08-06T10:00:00Z"
}
Fetch and cache each detail page with the same politeness as Stage 1: user-agent, timeout, status check, delay.
Aim your selectors at the product area of the page, not the whole document. "The first thing that looks like a price"
works today and betrays you the day the page grows a second price.
Some books have no description. Store null — never invent text that was not on the page.
Keep source_page and fetched_at on every record. That is provenance — the receipt showing where and
when a fact came from. When a value looks wrong three weeks from now, the receipt is how you find out what
happened.
Commit: Stage 3: extract book details

4 - Clean it, check it, store it
Raw strings are ingredients. The schema is the recipe.
Turn price_text ( "£51.77" ) into price_gbp ( 51.77 ) — a real number a program can sort and compare.
Keep the original text too: the raw value and the clean value live side by side.
Use the absolute product_url as each record's identity — its canonical URL. If the same book appears twice, it
counts once.
Write down the shape of a finished record as a schema, with Zod or Pydantic: which fields are required, what type
each one is, description optional.
Validate every record against the schema before storing it. A record that fails goes to errors.json together with
the reason — it never sneaks into books.json .
Write the good records to output/books.json . Running the scraper twice must produce the same 60 records
— not 120. That property is called idempotency, and it is what makes re-running a failed job safe.
Commit: Stage 4: validate normalized records

5 - One bad page must not kill the run
A good job finishes its work, then tells you what happened.
Handle each page separately, so one broken page is logged and skipped. Fifty-nine good records must survive
one bad one.
If a request fails with a timeout or a server error ( 5xx ), wait a moment and try once more. Do not retry a 404 (the
page does not exist — asking again will not create it) or a 403 (the site said no — asking again is how a polite
robot becomes a pest).
End every run by writing output/run-report.json with a few honest numbers: start time, duration, pages
fetched, cache hits, valid records, invalid records, failed pages. A scraper that reports nothing can fail silently for
weeks — the report is how you notice.
Prove it works: add one made-up book URL to your list on purpose and run. Break things on your side only —
never test failure by hammering the real site.
Commit: Stage 5: survive failures, report the run

6 - Publish the evidence
Your code is finished when a stranger can run it and trust the result.
Push the project to a public GitHub repo. Commit your code and one sample output — not hundreds of cached
HTML files (add cache/ to .gitignore ).
Finish the README: your target classification from Stage 0, one copy-pasteable run command, your lane and how
to install it, the record schema, the politeness rules you follow (user-agent, delay, timeout, cache), and one honest
limitation.
Paste one real run-report.json into the README as proof, and add one sentence on why this assignment
needed no browser: the data is already in the HTML the server sends, so a browser would only add cost.
Add a short ethics note in your own words: use an official API when one exists; never bypass logins, paywalls, or
blocks; collect only what you need.
Commit: Stage 6: publish scraper evidence — then push everything