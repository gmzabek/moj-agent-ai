const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_NEWS_RSS_URL =
  "https://news.google.com/rss?hl=pl&gl=PL&ceid=PL:pl";
const DEFAULT_PB_EDITION_URL = "https://www.pb.pl/wydanie";
const DEFAULT_UNUSUAL_HOLIDAYS_BASE_URL =
  "https://www.kalbi.pl/kalendarz-swiat-nietypowych";

export type Weather = {
  city: string;
  country: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: number;
  windSpeedUnit: string;
  precipitation: number;
  precipitationUnit: string;
  description: string;
  source: "Open-Meteo API";
};

export type ExchangeRate = {
  currency: string;
  name: string;
  rateToPln: number;
  effectiveDate: string;
  source: "Narodowy Bank Polski API";
};

export type CurrentDateTime = {
  iso: string;
  date: string;
  local: string;
  dayOfWeek: string;
  timezone: "Europe/Warsaw";
};

export type DayContext = {
  isWeekend: boolean;
  isPublicHoliday: boolean;
  holidayName: string | null;
  note: string;
};

export type NewsHeadline = {
  title: string;
  link: string;
  publishedAt: string | null;
};

export type MarketQuote = {
  symbol: string;
  name: string;
  market: "Nasdaq" | "NYSE" | "GPW";
  currency: string;
  price: number;
  previousClose: number | null;
  changePercent: number | null;
  asOf: string;
  source: "Yahoo Finance";
};

export type MarketOverview = {
  quotes: MarketQuote[];
  unavailableSymbols: string[];
  note: string;
};

export type PbEditionArticle = {
  title: string;
  lead: string;
  page: string | null;
  link: string;
};

export type PbEdition = {
  title: string;
  url: string;
  articles: PbEditionArticle[];
  source: "Puls Biznesu";
};

export type UnusualHolidayContext = {
  date: string;
  holidays: string[];
  url: string;
  source: "Kalbi.pl";
};

export type BibleQuote = {
  text: string;
  reference: string;
  translation: "NRSVue Catholic Edition";
};

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "morning-briefing/1.0",
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Źródło ${new URL(input).hostname} zwróciło HTTP ${response.status}.`,
      );
    }

    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
  });
  return (await response.json()) as T;
}

function weatherDescription(code: number) {
  const descriptions: Record<number, string> = {
    0: "bezchmurnie",
    1: "przeważnie bezchmurnie",
    2: "częściowe zachmurzenie",
    3: "pochmurno",
    45: "mgła",
    48: "mgła osadzająca szadź",
    51: "lekka mżawka",
    53: "mżawka",
    55: "intensywna mżawka",
    61: "lekki deszcz",
    63: "deszcz",
    65: "intensywny deszcz",
    71: "lekki śnieg",
    73: "śnieg",
    75: "intensywny śnieg",
    80: "przelotny deszcz",
    81: "przelotny deszcz",
    82: "gwałtowne przelotne opady",
    95: "burza",
    96: "burza z gradem",
    99: "silna burza z gradem",
  };

  return descriptions[code] ?? `kod pogodowy ${code}`;
}

export async function getWeather(city: string): Promise<Weather> {
  type GeoResponse = {
    results?: Array<{
      name: string;
      country: string;
      latitude: number;
      longitude: number;
    }>;
  };
  type WeatherResponse = {
    current: {
      temperature_2m: number;
      wind_speed_10m: number;
      precipitation: number;
      weather_code: number;
    };
    current_units: Record<string, string>;
  };

  const geo = await fetchJson<GeoResponse>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city,
    )}&count=1&language=pl&format=json`,
  );
  const location = geo.results?.[0];

  if (!location) {
    throw new Error(`Nie znaleziono miasta „${city}”.`);
  }

  const weather = await fetchJson<WeatherResponse>(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}` +
      `&longitude=${location.longitude}` +
      "&current=temperature_2m,precipitation,weather_code,wind_speed_10m" +
      "&timezone=Europe%2FWarsaw",
  );

  return {
    city: location.name,
    country: location.country,
    temperature: weather.current.temperature_2m,
    temperatureUnit: weather.current_units.temperature_2m,
    windSpeed: weather.current.wind_speed_10m,
    windSpeedUnit: weather.current_units.wind_speed_10m,
    precipitation: weather.current.precipitation,
    precipitationUnit: weather.current_units.precipitation,
    description: weatherDescription(weather.current.weather_code),
    source: "Open-Meteo API",
  };
}

export async function getExchangeRate(currency: string): Promise<ExchangeRate> {
  type NbpResponse = {
    code: string;
    currency: string;
    rates: Array<{ effectiveDate: string; mid: number }>;
  };

  const code = currency.trim().toUpperCase();
  const data = await fetchJson<NbpResponse>(
    `https://api.nbp.pl/api/exchangerates/rates/A/${encodeURIComponent(
      code,
    )}/?format=json`,
  );
  const latestRate = data.rates[0];

  if (!latestRate || !Number.isFinite(latestRate.mid)) {
    throw new Error(`NBP nie zwrócił kursu waluty ${code}.`);
  }

  return {
    currency: data.code,
    name: data.currency,
    rateToPln: latestRate.mid,
    effectiveDate: latestRate.effectiveDate,
    source: "Narodowy Bank Polski API",
  };
}

function datePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) {
    throw new Error(`Nie udało się odczytać części daty: ${type}.`);
  }
  return value;
}

export function currentDateTime(now = new Date()): CurrentDateTime {
  const timezone = "Europe/Warsaw" as const;
  const numericParts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(now);
  const date = `${datePart(numericParts, "year")}-${datePart(
    numericParts,
    "month",
  )}-${datePart(numericParts, "day")}`;
  const dayOfWeek = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    timeZone: timezone,
  }).format(now);

  return {
    iso: now.toISOString(),
    date,
    local: new Intl.DateTimeFormat("pl-PL", {
      dateStyle: "full",
      timeStyle: "medium",
      timeZone: timezone,
    }).format(now),
    dayOfWeek,
    timezone,
  };
}

export async function getPolishDayContext(
  dateTime: CurrentDateTime,
): Promise<DayContext> {
  type Holiday = { date: string; localName: string };
  const year = dateTime.date.slice(0, 4);
  const weekendDays = new Set(["sobota", "niedziela"]);
  const isWeekend = weekendDays.has(dateTime.dayOfWeek.toLowerCase());
  let holiday: Holiday | undefined;

  try {
    const holidays = await fetchJson<Holiday[]>(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/PL`,
    );
    holiday = holidays.find((item) => item.date === dateTime.date);
  } catch {
    // Brak odpowiedzi kalendarza nie powinien blokować całego briefingu.
  }

  const isPublicHoliday = Boolean(holiday);
  const note = isPublicHoliday
    ? `Święto ustawowo wolne od pracy: ${holiday?.localName}.`
    : isWeekend
      ? "Weekend — dla większości osób jest to dzień wolny od pracy."
      : "Zwykły dzień roboczy; brak święta ustawowo wolnego od pracy.";

  return {
    isWeekend,
    isPublicHoliday,
    holidayName: holiday?.localName ?? null,
    note,
  };
}

function decodeXml(value: string) {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&ndash;": "–",
    "&mdash;": "—",
    "&bdquo;": "„",
    "&rdquo;": "”",
  };

  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(
      /&(amp|lt|gt|quot|apos|#39|nbsp|ndash|mdash|bdquo|rdquo);/g,
      (entity) => entities[entity] ?? entity,
    )
    .trim();
}

function htmlText(value: string) {
  return decodeXml(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ");
}

function readXmlTag(item: string, tag: string) {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return item.match(new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"))?.[1];
}

export function parseRssHeadlines(xml: string, limit = 5): NewsHeadline[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return items
    .map((item) => {
      const title = readXmlTag(item, "title");
      const link = readXmlTag(item, "link");
      const publishedAt = readXmlTag(item, "pubDate");

      if (!title || !link) {
        return null;
      }

      return {
        title: decodeXml(title),
        link: decodeXml(link),
        publishedAt: publishedAt ? decodeXml(publishedAt) : null,
      };
    })
    .filter((item): item is NewsHeadline => item !== null)
    .slice(0, limit);
}

export async function getTopNews(limit = 5): Promise<NewsHeadline[]> {
  const rssUrl = process.env.NEWS_RSS_URL || DEFAULT_NEWS_RSS_URL;
  const response = await fetchWithTimeout(rssUrl, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });
  const headlines = parseRssHeadlines(await response.text(), limit);

  if (headlines.length === 0) {
    throw new Error("Kanał RSS nie zwrócił żadnych wiadomości.");
  }

  return headlines;
}

type MarketInstrument = {
  symbol: string;
  name: string;
  market: MarketQuote["market"];
};

const MARKET_INSTRUMENTS: MarketInstrument[] = [
  { symbol: "MSFT", name: "Microsoft", market: "Nasdaq" },
  { symbol: "NVDA", name: "Nvidia", market: "Nasdaq" },
  { symbol: "NVO", name: "Novo Nordisk ADR", market: "NYSE" },
  { symbol: "AMZN", name: "Amazon", market: "Nasdaq" },
  { symbol: "WIG20.WA", name: "WIG20", market: "GPW" },
  { symbol: "PKO.WA", name: "PKO BP", market: "GPW" },
  { symbol: "PKN.WA", name: "Orlen", market: "GPW" },
  { symbol: "PZU.WA", name: "PZU", market: "GPW" },
  { symbol: "KGH.WA", name: "KGHM", market: "GPW" },
  { symbol: "CDR.WA", name: "CD Projekt", market: "GPW" },
];

async function getMarketQuote(
  instrument: MarketInstrument,
): Promise<MarketQuote> {
  type YahooChartResponse = {
    chart: {
      error: { description?: string } | null;
      result:
        | Array<{
            meta: {
              chartPreviousClose?: number;
              currency?: string;
              regularMarketPrice?: number;
              regularMarketTime?: number;
            };
            indicators?: {
              quote?: Array<{ close?: Array<number | null> }>;
            };
          }>
        | null;
    };
  };

  const data = await fetchJson<YahooChartResponse>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      instrument.symbol,
    )}?range=5d&interval=1d`,
  );
  const result = data.chart.result?.[0];
  const price = result?.meta.regularMarketPrice;

  if (!result || !Number.isFinite(price)) {
    throw new Error(
      data.chart.error?.description ??
        `Brak aktualnego notowania ${instrument.symbol}.`,
    );
  }

  const closes =
    result.indicators?.quote?.[0]?.close?.filter(
      (value): value is number => typeof value === "number",
    ) ?? [];
  const previousClose =
    result.meta.chartPreviousClose ??
    (closes.length > 1 ? closes[closes.length - 2] : null);
  const changePercent =
    previousClose && Number.isFinite(previousClose)
      ? ((price! - previousClose) / previousClose) * 100
      : null;

  return {
    symbol: instrument.symbol.replace(".WA", ""),
    name: instrument.name,
    market: instrument.market,
    currency: result.meta.currency ?? (instrument.market === "GPW" ? "PLN" : "USD"),
    price: price!,
    previousClose,
    changePercent,
    asOf: result.meta.regularMarketTime
      ? new Date(result.meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
    source: "Yahoo Finance",
  };
}

export async function getMarketOverview(): Promise<MarketOverview> {
  const results = await Promise.allSettled(
    MARKET_INSTRUMENTS.map((instrument) => getMarketQuote(instrument)),
  );
  const quotes = results
    .filter(
      (result): result is PromiseFulfilledResult<MarketQuote> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
  const unavailableSymbols = results
    .map((result, index) =>
      result.status === "rejected" ? MARKET_INSTRUMENTS[index].symbol : null,
    )
    .filter((symbol): symbol is string => symbol !== null);

  if (quotes.length === 0) {
    throw new Error("Źródło notowań nie zwróciło żadnych danych.");
  }

  return {
    quotes,
    unavailableSymbols,
    note:
      "Notowania informacyjne, mogą być opóźnione. MSFT, NVDA i AMZN są notowane na Nasdaq; NVO na NYSE.",
  };
}

export function parsePbEdition(html: string, limit = 7): PbEdition {
  const heading =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
    "Aktualne wydanie Pulsu Biznesu";
  const itemMatches =
    html.match(
      /<li[^>]*class="[^"]*m-listing-article-list__item[^"]*"[^>]*>[\s\S]*?<\/li>/gi,
    ) ?? [];
  const articles = itemMatches
    .map((item): PbEditionArticle | null => {
      const link = item.match(
        /<a[^>]*class="[^"]*m-listing-article-list__anchor[^"]*"[^>]*href="([^"]+)"/i,
      )?.[1];
      const title = item.match(
        /<div[^>]*class="[^"]*m-listing-article-list__title[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      )?.[1];
      const lead = item.match(
        /<div[^>]*class="[^"]*m-listing-article-list__lead[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      )?.[1];
      const page = item.match(
        /<div[^>]*class="[^"]*m-listing-article-list__page-number[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      )?.[1];

      if (!link || !title) {
        return null;
      }

      return {
        title: htmlText(title),
        lead: lead ? htmlText(lead).slice(0, 420) : "",
        page: page ? htmlText(page) : null,
        link: decodeXml(link),
      };
    })
    .filter((article): article is PbEditionArticle => article !== null)
    .slice(0, limit);

  if (articles.length === 0) {
    throw new Error("Nie udało się odczytać listy artykułów z wydania PB.");
  }

  return {
    title: htmlText(heading),
    url: DEFAULT_PB_EDITION_URL,
    articles,
    source: "Puls Biznesu",
  };
}

export async function getPulsBiznesuEdition(limit = 7): Promise<PbEdition> {
  const url = process.env.PB_EDITION_URL || DEFAULT_PB_EDITION_URL;
  const response = await fetchWithTimeout(url, {
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  const edition = parsePbEdition(await response.text(), limit);

  return { ...edition, url };
}

const POLISH_MONTH_SLUGS = [
  "styczen",
  "luty",
  "marzec",
  "kwiecien",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpien",
  "wrzesien",
  "pazdziernik",
  "listopad",
  "grudzien",
];

export function parseUnusualHolidays(html: string, day: number) {
  const article = html.match(
    new RegExp(
      `<article[^>]*class="[^"]*unusual-day[^"]*"[^>]*id="${day}"[^>]*>([\\s\\S]*?)<\\/article>`,
      "i",
    ),
  )?.[1];

  if (!article) {
    return [];
  }

  return Array.from(
    article.matchAll(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/gi),
    (match) => htmlText(match[1]),
  ).filter(Boolean);
}

export async function getUnusualHolidayContext(
  dateTime: CurrentDateTime,
): Promise<UnusualHolidayContext> {
  const [year, month, day] = dateTime.date.split("-").map(Number);
  const monthSlug = POLISH_MONTH_SLUGS[month - 1];

  if (!monthSlug || !day) {
    throw new Error("Nieprawidłowa data dla kalendarza świąt nietypowych.");
  }

  const baseUrl =
    process.env.UNUSUAL_HOLIDAYS_BASE_URL ||
    DEFAULT_UNUSUAL_HOLIDAYS_BASE_URL;
  const url = `${baseUrl}-${monthSlug}-${year}`;
  const response = await fetchWithTimeout(url, {
    headers: { Accept: "text/html,application/xhtml+xml" },
  });

  return {
    date: dateTime.date,
    holidays: parseUnusualHolidays(await response.text(), day),
    url,
    source: "Kalbi.pl",
  };
}

const BIBLE_QUOTES: BibleQuote[] = [
  {
    text: "I can do all things through him who strengthens me.",
    reference: "Philippians 4:13",
    translation: "NRSVue Catholic Edition",
  },
  {
    text: "Blessed are the peacemakers, for they will be called children of God.",
    reference: "Matthew 5:9",
    translation: "NRSVue Catholic Edition",
  },
  {
    text: "Rejoice in the Lord always; again I will say, Rejoice.",
    reference: "Philippians 4:4",
    translation: "NRSVue Catholic Edition",
  },
  {
    text: "And now faith, hope, and love remain, these three, and the greatest of these is love.",
    reference: "1 Corinthians 13:13",
    translation: "NRSVue Catholic Edition",
  },
  {
    text: "Be kind to one another, tenderhearted, forgiving one another, as God in Christ has forgiven you.",
    reference: "Ephesians 4:32",
    translation: "NRSVue Catholic Edition",
  },
  {
    text: "Rejoice in hope; be patient in affliction; persevere in prayer.",
    reference: "Romans 12:12",
    translation: "NRSVue Catholic Edition",
  },
  {
    text: "Let all that you do be done in love.",
    reference: "1 Corinthians 16:14",
    translation: "NRSVue Catholic Edition",
  },
];

export function getBibleQuote(date: string): BibleQuote {
  const seed = Array.from(date).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return BIBLE_QUOTES[seed % BIBLE_QUOTES.length];
}
