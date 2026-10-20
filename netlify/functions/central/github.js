export default async function handler(req, res) {
  const { action } = req.query;

  switch (action) {
    case "getWeekly":
      // Mock data for now - replace with actual API call
      return res.json([
        { day: "Segunda", done: false },
        { day: "Terça", done: true },
        { day: "Quarta", done: false },
        { day: "Quinta", done: false },
        { day: "Sexta", done: true },
        { day: "Sábado", done: false },
        { day: "Domingo", done: false }
      ]);
    case "toggle":
      // Real toggle functionality - in production this would update a database
      const { index, done } = req.body;
      // For now, just return success - in production you would save to database
      return res.json({ success: true, index, done });
    default:
      return res.status(400).json({ error: "Invalid action" });
  }
}
