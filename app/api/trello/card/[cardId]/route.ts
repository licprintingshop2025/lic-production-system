import { NextResponse } from "next/server";

async function removePriorityLabels(
  cardId: string,
  key: string,
  token: string,
) {
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}/labels?key=${key}&token=${token}`,
    { cache: "no-store" },
  );

  if (!res.ok) return;

  const labels = await res.json();

  for (const label of labels) {
    if (
      label.name?.toLowerCase() === "rush" ||
      label.name?.toLowerCase() === "normal"
    ) {
      await fetch(
        `https://api.trello.com/1/cards/${cardId}/idLabels/${label.id}?key=${key}&token=${token}`,
        { method: "DELETE" },
      );
    }
  }
}

async function addPriorityLabel(
  cardId: string,
  priority: string,
  key: string,
  token: string,
) {
  const isRush = priority.toLowerCase() === "rush";

  await fetch(
    `https://api.trello.com/1/cards/${cardId}/labels?key=${key}&token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: isRush ? "Rush" : "Normal",
        color: isRush ? "red" : "green",
      }),
    },
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;

  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!key || !token) {
    return NextResponse.json(
      { error: "Missing Trello credentials" },
      { status: 500 },
    );
  }

  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}?fields=name,desc,due,idList,url,labels&key=${key}&token=${token}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const card = await res.json();

  return NextResponse.json({ card });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;

  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  const body = await req.json();

  if (!key || !token) {
    return NextResponse.json(
      { error: "Missing Trello credentials" },
      { status: 500 },
    );
  }

  const updateBody: Record<string, string> = {};

  if (body.listId) {
    updateBody.idList = body.listId;
  }

  if (body.desc) {
    updateBody.desc = body.desc;
  }

  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}?key=${key}&token=${token}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateBody),
    },
  );

  if (!res.ok) {
    const errorText = await res.text();

    return NextResponse.json(
      { error: "Failed to update card", details: errorText },
      { status: 500 },
    );
  }

  const card = await res.json();

  if (body.orderPriority) {
    await removePriorityLabels(cardId, key, token);
    await addPriorityLabel(cardId, body.orderPriority, key, token);
  }

  return NextResponse.json({ success: true, card });
}
