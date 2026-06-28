const DISCORD_APP_ID = process.env.HC_DISCORD_APP_ID;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID;
const DISCORD_BOT_TOKEN = process.env.HC_DISCORD_BOT_TOKEN;
const HARDCOVER_API_KEY = process.env.HARDCOVER_API_KEY;

const CURRENT_YEAR = new Date().getFullYear();

const query = `
query GetReadingData {
  me {
    username
    name
    image { url }
    created_at
    goals(where: { state: { _eq: "active" } }, limit: 1) {
      goal
      progress
    }
    currently_reading: user_books(
      where: { status_id: { _eq: 2 } }
      order_by: { updated_at: desc }
      limit: 1
    ) {
      user_book_reads {
        progress
      }
      book {
        title
        image { url }
        contributions(limit: 1) {
          author { name }
        }
      }
    }
    read_books: user_books(where: { status_id: { _eq: 3 } }) {
      id
    }
    earliest_read_book: user_books(
      where: { status_id: { _eq: 3 }, last_read_date: { _is_null: false } }
      order_by: { last_read_date: asc }
      limit: 1
    ) {
      last_read_date
    }
  }
}
`;

async function updateWidget() {
  try {
    console.log(`Fetching stats from Hardcover API...`);

    const hcRes = await fetch("https://api.hardcover.app/v1/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${HARDCOVER_API_KEY}`,
      },
      body: JSON.stringify({ query }),
    });

    const hcData = await hcRes.json();

    if (hcData.errors) {
      console.error("Hardcover GraphQL API Error:");
      console.error(JSON.stringify(hcData.errors, null, 2));
      return;
    }

    const user = hcData.data.me[0];
    const booksRead = user.read_books?.length || 0;

    const joinDate = new Date(user.created_at);
    const daysAgoJoined = Math.floor(
      (new Date() - joinDate) / (1000 * 60 * 60 * 24),
    );

    const earliestBookDate = user.earliest_read_book?.[0]?.last_read_date;
    const trackingStartDate = earliestBookDate
      ? new Date(earliestBookDate)
      : joinDate;
    const totalTrackingDays = Math.floor(
      (new Date() - trackingStartDate) / (1000 * 60 * 60 * 24),
    );

    // total tracked days divided by total books read
    const pace =
      booksRead > 0
        ? (totalTrackingDays / booksRead).toFixed(2)
        : daysAgoJoined;

    const activeGoalObj = user.goals?.[0];
    const apiGoal = activeGoalObj?.goal || 0;
    const booksReadThisYear = activeGoalObj?.progress || 0;

    const goalPercentage =
      apiGoal > 0 ? Math.floor((booksReadThisYear / apiGoal) * 100) : 0;
    const goalString =
      apiGoal > 0
        ? `${booksReadThisYear}/${apiGoal} (${goalPercentage}%)`
        : "No active goal";
    const goalTitleString =
      apiGoal > 0
        ? `Read ${apiGoal} books by 12/31/${CURRENT_YEAR}`
        : "No active reading goal";

    const currentBookObj = user.currently_reading?.[0];
    const bookProgressPercent =
      currentBookObj?.user_book_reads?.[0]?.progress || 0;

    const payload = {
      username: user.name || user.username,
      data: {
        dynamic: [
          {
            type: 3,
            name: "profile_image",
            value: {
              url: user.image?.url || "https://hardcover.app/default.png",
            },
          },
          {
            type: 1,
            name: "books_read",
            value: `${booksRead} total books read`,
          },
          { type: 1, name: "reading_goal", value: goalTitleString },
          {
            type: 1,
            name: "reading_pace",
            value: `I read a book every ${pace} days.`,
          },
          {
            type: 3,
            name: "recent_book_image",
            value: {
              url:
                currentBookObj?.book?.image?.url ||
                "https://hardcover.app/default.png",
            },
          },
          {
            type: 1,
            name: "recent_book_name",
            value: currentBookObj?.book?.title || "Nothing currently!",
          },
          {
            type: 1,
            name: "recent_book_author",
            value:
              currentBookObj?.book?.contributions?.[0]?.author?.name || "-",
          },
          {
            type: 2,
            name: "progress",
            value: bookProgressPercent / 100 || 0.0,
          },
          {
            type: 1,
            name: "join_date",
            value: `Joined ${daysAgoJoined} days ago`,
          },
          { type: 1, name: "reading_goal_progress", value: goalString },
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
