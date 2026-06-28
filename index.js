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

async function updateWidget() {
  try {
    console.log(`Fetching stats from AniList for ${ANILIST_USERNAME}...`);

    const anilistRes = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { userName: ANILIST_USERNAME },
      }),
    });

    const anilistData = await anilistRes.json();

    if (anilistData.errors) {
      console.error("AniList API Error:", anilistData.errors);
      return;
    }

    const user = anilistData.data.User;
    const stats = user.statistics;

    const creationDate = new Date(user.createdAt * 1000);
    const trackingDate = creationDate.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    const daysWatched = (stats.anime.minutesWatched / 1440).toFixed(1);
    const animeMeanScore = stats.anime.meanScore
      ? stats.anime.meanScore.toString()
      : "0";
    const mangaMeanScore = stats.manga.meanScore
      ? stats.manga.meanScore.toString()
      : "0";

    let activityType = "No recent activity";
    let activityData = "";
    let recentActivityImage = null;
    const recentList = anilistData.data.Page.mediaList[0];

    if (recentList) {
      const media = recentList.media;
      const title =
        media.title.english || media.title.romaji || media.title.userPreferred;
      const status = recentList.status;
      const progress = recentList.progress;
      const isAnime = media.type === "ANIME";

      recentActivityImage = media.coverImage.large;
      activityData = title;

      switch (status) {
        case "CURRENT":
          const unit = isAnime ? "episode" : "chapter";
          const action = isAnime ? "Watched" : "Read";
          activityType =
            progress > 0 ? `${action} ${unit} ${progress} of` : `${action}`;
          break;
        case "COMPLETED":
          activityType = `Completed ${title}`;
          break;
        case "PLANNING":
          activityType = `Plan to ${isAnime ? "watch" : "read"} ${title}`;
          break;
        case "REPEATING":
          activityType = `Re-${isAnime ? "watched" : "read"} ${title}`;
          break;
        case "PAUSED":
          activityType = `Paused ${title}`;
          break;
        case "DROPPED":
          activityType = `Dropped ${title}`;
          break;
        default:
          activityType = `Updated ${title}`;
          break;
      }

      if (activityData.length > 55) {
        activityData = activityData.substring(0, 52) + "...";
      }
    }

    // Build the payload
    const payload = {
      username: ANILIST_USERNAME,
      data: {
        dynamic: [
          { type: 1, name: "anilist_username", value: ANILIST_USERNAME },
          {
            type: 1,
            name: "days_active",
            value: `Tracking since ${trackingDate}`,
          },
          { type: 2, name: "anime_count", value: stats.anime.count },
          { type: 1, name: "days_watched", value: daysWatched.toString() },
          {
            type: 1,
            name: "anime_mean_score",
            value: animeMeanScore.toString(),
          },
          { type: 2, name: "manga_count", value: stats.manga.count },
          { type: 2, name: "chapters_read", value: stats.manga.chaptersRead },
          {
            type: 1,
            name: "manga_mean_score",
            value: mangaMeanScore.toString(),
          },
          { type: 1, name: "activity_type", value: activityType },
        ],
      },
    };

    if (recentActivityImage) {
      payload.data.dynamic.push({
        type: 3,
        name: "activity_image",
        value: { url: recentActivityImage },
      });
    }
    payload.data.dynamic.push({
      type: 1,
      name: "activity_data",
      value: activityData,
    });

    const discordUrl = `https://discord.com/api/v9/applications/${DISCORD_APP_ID}/users/${DISCORD_USER_ID}/identities/0/profile`;

    const discordRes = await fetch(discordUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "User-Agent":
          "DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)",
      },
      body: JSON.stringify(payload),
    });

    if (discordRes.ok) {
      console.log("✅ Successfully updated Discord!");
      console.log(`Pushed Activity Type: "${activityType}"`);
      console.log(`Pushed Activity Data: "${activityData}"`);
    } else {
      console.error("❌ Failed:", await discordRes.text());
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

updateWidget();
