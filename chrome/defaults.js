const DEFAULT_BLOCKED_DOMAINS_VERSION = 4;

const REMOVED_DEFAULT_BLOCKED_DOMAINS = [
  "adroll.com", "adservice.google.com", "alibaba.com", "aliexpress.com",
  "amazon.com", "apple.com/music", "bbc.co.uk", "bbc.com",
  "bestbuy.com", "binance.com", "bloomberg.com", "buzzfeed.com", "cnn.com",
  "coinbase.com", "coingecko.com", "coinmarketcap.com", "craigslist.org",
  "doubleclick.net",
  "ebay.com", "engadget.com", "etsy.com", "foxnews.com", "gamespot.com",
  "googlesyndication.com", "huffpost.com", "ign.com", "kraken.com", "mailchimp.com",
  "medium.com", "msnbc.com", "news.ycombinator.com",
  "newsletters.example.com", "nytimes.com", "outbrain.com", "quora.com", "rakuten.com",
  "roku.com", "shopify.com", "slack.com", "substack.com", "taboola.com", "techcrunch.com",
  "theguardian.com", "theverge.com", "vice.com", "wired.com", "wish.com", "wsj.com",
];

const KOSHER_BLOCKED_DOMAINS = Object.freeze([
  // Explicit adult content
  "adultfriendfinder.com", "brazzers.com", "cam4.com", "chaturbate.com",
  "eporner.com", "livejasmin.com", "motherless.com", "naughtyamerica.com",
  "onlyfans.com", "pornhub.com", "redtube.com", "realitykings.com", "spankbang.com",
  "stripchat.com", "tube8.com", "xhamster.com", "xnxx.com", "xvideos.com", "youporn.com",

  // Gambling and betting
  "888casino.com", "888poker.com", "bet365.com", "betway.com", "bovada.lv",
  "casino.com", "draftkings.com", "fanduel.com", "gambling.com", "pokerstars.com",
  "roobet.com", "stake.com",

  // Dating and hookup services
  "ashleymadison.com", "badoo.com", "bumble.com", "eharmony.com", "grindr.com",
  "hinge.co", "match.com", "okcupid.com", "pof.com", "tinder.com",

  // Mixed-content and social platforms in strict family filters
  "discord.com", "facebook.com", "instagram.com", "pinterest.com", "reddit.com",
  "snapchat.com", "t.me", "telegram.org", "tiktok.com", "tumblr.com", "twitch.tv",
  "twitter.com", "x.com", "youtu.be", "youtube.com",

  // Streaming, gaming, and unmoderated media platforms in strict filters
  "battle.net", "crunchyroll.com", "dailymotion.com", "disneyplus.com", "epicgames.com",
  "giphy.com", "hbomax.com", "hulu.com", "imgur.com", "kick.com", "kongregate.com",
  "last.fm", "miniclip.com", "netflix.com", "pandora.com", "primevideo.com",
  "roblox.com", "soundcloud.com", "spotify.com", "steamcommunity.com",
  "store.steampowered.com", "tenor.com", "vimeo.com",

  // Filter-circumvention and anonymous proxy services
  "croxyproxy.com", "expressvpn.com", "hide.me", "hola.org", "kproxy.com",
  "nordvpn.com", "protonvpn.com", "proxysite.com", "psiphon.ca", "surfshark.com",
  "torproject.org", "windscribe.com",

  // Piracy and torrent indexes
  "1337x.to", "fitgirl-repacks.site", "kickasstorrents.to", "rarbg.to",
  "skidrowreloaded.com", "thepiratebay.org", "yts.mx",
]);
