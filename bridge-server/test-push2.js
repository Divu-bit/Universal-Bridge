async function testPush2() {
  const token = "ExponentPushToken[_8y-QPBiyuY1n51EMYeR1Y]";
  
  const message = {
    to: token,
    sound: 'default',
    title: '💧 Drink Water!',
    body: 'You haven\'t had water in 2 hours.',
    data: {
      interactiveSchema: JSON.stringify([
        { type: "display_text", label: "Stay hydrated! Your last glass was 2 hours ago." },
        { type: "button", label: "✅ Done, just drank!", action: "drank", webhookUrl: "https://universal-bridge.onrender.com/test-webhook" },
        { type: "button", label: "⏰ Remind in 30min", action: "snooze", webhookUrl: "https://universal-bridge.onrender.com/test-webhook" }
      ])
    }
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    const result = await response.json();
    console.log("Water reminder sent!");
    console.log(result);
  } catch (error) {
    console.error("Failed:", error);
  }
}

testPush2();
