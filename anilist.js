const DISCORD_APP_ID = process.env.DISCORD_APP_ID;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const ANILIST_USERNAME = "Kakitzu";

const query = `
query ($userName: String) {
  User(name: $userName) {
    createdAt
    statistics {
      anime { count, minutesWatched, meanScore }
      manga { count, chaptersRead, meanScore }
    }
  }
  Page(page: 1, perPage: 1) {
    mediaList(userName: $userName, sort: UPDATED_TIME_DESC) {
      status
      progress
      media {
        title { english romaji userPreferred }
        coverImage { large }
        type
      }
    }
  }
}
`;

function buildActivityFields(recentList) {
  if (!recentList) {
    return { activityType: "No recent activity", activityData: "", image: null };
  }

  const { media, status, progress } = recentList;
  const title =
    media.title.english || media.title.romaji || media.title.userPreferred;
  const isAnime = media.type === "ANIME";

  let activityType;
  switch (status) {
    case "CURRENT": {
      const unit = isAnime ? "Episode" : "Chapter";
      const action = isAnime ? "Watched" : "Read";
      activityType = progress > 0 ? `${action} ${unit} ${progress} of` : action;
      break;
    }
    case "COMPLETED":
      activityType = "Completed";
      break;
    case "PLANNING":
      activityType = `Plan to ${isAnime ? "watch" : "read"}`;
      break;
    case "REPEATING":
      activityType = `Re-${isAnime ? "watching" : "reading"}`;
      break;
    case "PAUSED":
      activityType = "Paused";
      break;
    case "DROPPED":
      activityType = "Dropped";
      break;
    default:
      activityType = "Updated";
      break;
  }

  return {
    activityType,
    activityData,
    image: media.coverImage.large,
  };
}

async function updateWidget() {
  try {
    console.log(`Fetching stats from AniList for ${ANILIST_USERNAME}...`);

    const anilistRes = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables: { userName: ANILIST_USERNAME } }),
    });

    if (!anilistRes.ok) {
      console.error(`AniList HTTP error: ${anilistRes.status}`);
      return;
    }

    const anilistData = await anilistRes.json();

    if (anilistData.errors) {
      console.error("AniList API Error:", anilistData.errors);
      return;
    }

    const user = anilistData.data.User;
    const stats = user.statistics;

    const trackingDate = new Date(user.createdAt * 1000).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    const daysWatched = (stats.anime.minutesWatched / 1440).toFixed(1);
    const animeMeanScore = stats.anime.meanScore?.toString() ?? "0";
    const mangaMeanScore = stats.manga.meanScore?.toString() ?? "0";

    const { activityType, activityData, image } = buildActivityFields(
      anilistData.data.Page.mediaList[0]
    );

    const dynamic = [
      { type: 1, name: "anilist_username", value: ANILIST_USERNAME },
      { type: 1, name: "days_active",      value: `Tracking since ${trackingDate}` },
      { type: 2, name: "anime_count",      value: stats.anime.count },
      { type: 1, name: "days_watched",     value: daysWatched.toString() },
      { type: 1, name: "anime_mean_score", value: animeMeanScore },
      { type: 2, name: "manga_count",      value: stats.manga.count },
      { type: 2, name: "chapters_read",    value: stats.manga.chaptersRead },
      { type: 1, name: "manga_mean_score", value: mangaMeanScore },
      { type: 1, name: "activity_type",    value: activityType },
    ];

    if (image) {
      dynamic.push({ type: 3, name: "activity_image", value: { url: image } });
    }
    dynamic.push({ type: 1, name: "activity_data", value: activityData });

    const payload = { username: ANILIST_USERNAME, data: { dynamic } };

    const discordUrl = `https://discord.com/api/v9/applications/${DISCORD_APP_ID}/users/${DISCORD_USER_ID}/identities/0/profile`;

    const discordRes = await fetch(discordUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "User-Agent": "DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)",
      },
      body: JSON.stringify(payload),
    });

    if (discordRes.ok) {
      console.log("✅ Successfully updated Discord!");
      console.log(`Pushed Activity Type: "${activityType}"`);
      console.log(`Pushed Activity Data: "${activityData}"`);
    } else {
      console.error(`❌ Failed (HTTP ${discordRes.status}):`, await discordRes.text());
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

updateWidget();
