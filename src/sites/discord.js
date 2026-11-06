// Discord web app. class names are hashed (message_ab12cd), but message rows keep id="chat-messages-..."
// and the sidebar uses data-list-item-id, which discord's own keyboard nav depends on. those stay.
(function () {
  const SS = globalThis.NoSpoil;

  SS.sites.register({
    id: 'discord',
    name: 'Discord (web)',
    home: 'https://discord.com/channels/@me',
    hosts: /(^|\.)discord\.com$/,

    items: [
      ['li[id^="chat-messages-"]', 'a message, with its embeds, link previews and attachments'],
      ['[data-list-item-id^="channels___"]', 'channel names in the sidebar (#gta6-leaks and friends)'],
      ['[data-list-item-id^="guildsnav___"]', 'server icons on the far left (the name is in the aria-label)'],
      ['[class*="searchResult_"]', 'search results'],
      ['[class*="threadSidebar"] li[id^="chat-messages-"]', 'thread messages'],
      ['[id^="forum-post-"]', 'forum channel posts'],
    ],

    channel: ['[id^="message-username-"]', 'h3 [class*="username"]'],
  });
})();
