const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_NEWS_RSS_URL =
  "https://news.google.com/rss?hl=pl&gl=PL&ceid=PL:pl";

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
  };

  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (entity) => entities[entity] ?? entity)
    .trim();
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
