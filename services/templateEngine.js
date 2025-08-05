// Template definitions
const templates = {
  "Magic & Stardust": {
    content: `<p>My dearest <span class="personalized-text">{name}</span>,</p>
<p>There's something truly magical that I want to share with you. You see, every time something wonderful and unexpected happens, something that makes your heart skip a beat, real magic is at work. This magic is all around us, especially at Christmas, and it's made even stronger by those who believe in it.</p>
<p>I can see the magic that shines within you, <span class="personalized-text">{name}</span>. When you believe in magic, it comes out of you like stardust, brightening everything around you. What I find most magical about you is the way you <span class="personalized-text">{achievement}</span>. You bring light and joy to everyone you meet.</p>
<p>Christmas is the most magical time of the year, when the world is filled with wonder and joy. It's the perfect time to believe in magic because it's when the magic is strongest. When I arrived in <span class="personalized-text">{location}</span> to deliver this letter, I found my way because of your belief. Your magic guided me here, lighting the way just like the stars in the night sky.</p>
<p>So, the next time you feel something magical, remember that it's your belief that makes it real. Keep that magic alive in your heart, <span class="personalized-text">{name}</span>, because every time you believe, you help make the world a more magical place.</p>
<p>With all my love and Christmas magic,</p>`
  },
  
  "The Watchful Elf": {
    content: `<p>My dearest <span class="personalized-text">{name}</span>,</p>
<p>I have been looking forward to writing this letter to you for some time <span class="personalized-text">{name}</span>. I've seen how kind you have been this year, always bringing happiness to those around you. Your kindness has not gone unnoticed. It shines so brightly, even here at the North Pole. But did you know it is not just me who has been watching over you? There's a special little elf in my workshop named Ember, who thinks you're truly amazing. Ember is a shy little elf, with red hair and rosy cheeks, and <span class="personalized-text">{name}</span>, you have become very special to them.</p>
<p>Ember told me how you <span class="personalized-text">{achievement}</span> and how you show kindness in ways big and small. Every time you do, the stars above the North Pole twinkle a little brighter, helping me find my way to you on Christmas Eve. Ember really wanted to deliver this letter to you tonight. They have never been to <span class="personalized-text">{location}</span>, but no matter how much the reindeer reassured them, Ember is still afraid of flying.</p>
<p>Remember, <span class="personalized-text">{name}</span>, the real magic of Christmas is in believing. Believing in magic. Ember and I are so proud of you. Not just for what you have achieved, but for the kind and thoughtful person you are. Keep believing in that magic and it will shine through you all year long, lighting up the lives of those around you.</p>
<p>With all my love and Christmas magic,</p>`
  }
};

function processTemplate(templateName, variables) {
  const template = templates[templateName];
  
  if (!template) {
    console.error(`Template "${templateName}" not found. Using default.`);
    return `<p>My dearest <span class="personalized-text">${variables.name}</span>,</p>
<p>What a wonderful year you've had! I've been watching you and I'm so proud of how you <span class="personalized-text">${variables.achievement}</span>.</p>
<p>Here in <span class="personalized-text">${variables.location}</span>, your kindness and belief in magic make the world a brighter place.</p>
<p>Keep being the amazing person you are!</p>
<p>With all my love and Christmas magic,</p>`;
  }
  
  let content = template.content;
  
  // Replace all variables
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{${key}}`, 'g');
    content = content.replace(regex, variables[key] || '');
  });
  
  return content;
}

module.exports = { processTemplate };