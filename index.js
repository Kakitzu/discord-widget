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
    const user = anilistData.data.User;
    const stats = user.statistics;

    const daysWatched = parseFloat(
      (stats.anime.minutesWatched / 1440).toFixed(1),
    );

    const creationDate = new Date(user.createdAt * 1000);
    const trackingDate = creationDate.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

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
          { type: 2, name: "days_watched", value: daysWatched },
          { type: 2, name: "anime_mean_score", value: stats.anime.meanScore },
          { type: 2, name: "manga_count", value: stats.manga.count },
          { type: 2, name: "chapters_read", value: stats.manga.chaptersRead },
          { type: 2, name: "manga_mean_score", value: stats.manga.meanScore },
        ],
      },
    };

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
    } else {
      console.error("❌ Failed:", await discordRes.text());
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

updateWidget();
