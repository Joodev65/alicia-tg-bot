const { Telegraf, Markup } = require('telegraf');
const chalk = require('chalk');
const axios = require('axios');
const config = require('../Alicia/alicia');
const bot = new Telegraf(config.botToken);

function rainbowLog(text) {
  const colors = [
    chalk.bold.red,
    chalk.bold.green,
    chalk.bold.yellow,
    chalk.bold.blue,
    chalk.bold.magenta,
    chalk.bold.cyan,
    chalk.bold.white
  ];
  const colorFn = colors[Math.floor(Math.random() * colors.length)];
  console.log(colorFn(text));
}

bot.use((ctx, next) => {
  rainbowLog(`⌬ MSG ${ctx.from.id} - ${ctx.message?.text || 'non-text'}`);
  return next();
});

bot.command('start', async (ctx) => {
  try {
    await ctx.sendChatAction('typing');
    await ctx.replyWithPhoto(
      'https://files.catbox.moe/ev25ly.jpg',
      {
        caption: `๏ 𝗔𝗟𝗜𝗖𝗜𝗔 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡𝗧

➻ <b>Assistant bot created to serve you in searching and listening to music, with artificial intelligence features that help.</b>
──────────────────        
๏ <b>Click on the help button to get information about my modules and commands.</b>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'ᴘʟᴀʏ ᴍᴜsɪᴄ', callback_data: 'spotify' }],
            [
              { text: 'ɪɴғᴏ', callback_data: 'info' },
              { text: 'ᴄʜᴀᴛɢᴘᴛ', callback_data: 'chatgpt' }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error('error in /start:', error);
    ctx.reply('error');
  }
});

bot.action('spotify', async (ctx) => {
  try {
    await ctx.deleteMessage();
    await ctx.reply('Masukin Judul Lagu');
    ctx.session = ctx.session || {};
    ctx.session.waitingForMusic = true;
  } catch (error) {
    console.error('error', error);
    ctx.reply('error.');
  }
});

bot.on('text', async (ctx) => {
  try {
    if (ctx.session?.waitingForMusic) {
      const title = ctx.message.text;
      delete ctx.session.waitingForMusic;
      await ctx.sendChatAction('typing');

      const { data } = await axios.get(`https://aliicia.my.id/api/music?alicia=${encodeURIComponent(title)}`);
      
      if (data.status && data.result?.length > 0) {
        const tracks = data.result.slice(0, 10);
        let message = '<b>Music Result</b>\n\n';
        const buttons = [];

        tracks.forEach((track, index) => {
          message += `${index + 1}. ${track.title}\n`;
          buttons.push([{ 
            text: `${index + 1}`, 
            callback_data: `play_track_${track.id}_${index}` 
          }]);
        });

        await ctx.reply(message, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons }
        });
      } else {
        await ctx.reply('Tidak ditemukan hasil untuk pencarian tersebut.');
      }
    }

    if (ctx.session?.waitingForChatGPT) {
      const question = ctx.message.text;
      delete ctx.session.waitingForChatGPT;
      await ctx.sendChatAction('typing');

      try {
        const { data } = await axios.post(
          'https://aliicia.my.id/api/chatgpt',
          {
            message: `
Aturan format Jawaban:
- Gunakan Markdown Telegram sederhana (bold, bullet).
- Dilarang menggunakan tabel.
- Jika jawaban adalah penjelasan biasa, pakai teks + bullet/heading saja.
- Jika pertanyaan meminta atau membutuhkan kode (JS, HTML, CSS, dll), gunakan blok kode (\`\`\`) sesuai bahasa yang diminta.
- Jangan gunakan karakter aneh atau emoji berlebihan.
- Langsung To Point jawab pertanyaan, gausah sebut ulang promt dalam jawaban
- Jika ragu suatu teks aman untuk Markdown Gunakan Teks Biasa tanpa Markdown.
Fokus utama: jawaban HARUS aman dikirim ke Telegram tanpa error parse

Pertanyaan:
${question}
`
          },
          { headers: { 'Content-Type': 'application/json' } }
        );

        let answer = data?.response || 'failedd';
        if (answer.length > 4096) {
          answer = answer.substring(0, 4000) + '\n\n... (pesan dipotong karena terlalu panjang)';
        }
        
        await ctx.reply(answer, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('errror calling api', error);
        ctx.reply('error response');
      }
    }
  } catch (error) {
    console.error('error in text handler:', error);
    ctx.reply('terjadi error.');
  }
});

bot.action(/play_track_(\d+)_(\d+)/, async (ctx) => {
  try {
    const trackId = ctx.match[1];
    const index = ctx.match[2];
    await ctx.sendChatAction('typing');

    const messageLines = ctx.callbackQuery.message.text.split('\n');
    const title = messageLines[parseInt(index) + 2].replace(/^\d+\.\s/, '');

    const searchRes = await axios.get(`https://aliicia.my.id/api/music?alicia=${encodeURIComponent(title)}`);
    
    if (searchRes.data.status && searchRes.data.result) {
      const tracks = searchRes.data.result;
      const track = tracks.find(t => t.id == trackId) || tracks[0];
      
      const dlRes = await axios.get(`https://aliicia.my.id/api/music?download=${encodeURIComponent(track.url)}`);
      
      if (dlRes.data.status && dlRes.data.result.download_url) {
        await ctx.replyWithPhoto(
          track.thumbnail || 'https://files.catbox.moe/ev25ly.jpg',
          {
            caption: `<b>${track.title}</b>`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[{ text: 'ᴛʀᴀᴄᴋ', url: track.url }]]
            }
          }
        );

        await ctx.replyWithAudio(
          { url: dlRes.data.result.download_url },
          {
            title: track.title,
            performer: track.author.name || 'JooModdss'
          }
        );

        await ctx.deleteMessage();
      } else {
        ctx.reply('Gagal mendapatkan URL download.');
      }
    } else {
      ctx.reply('Track tidak ditemukan.');
    }
  } catch (error) {
    console.error('Error playing track:', error);
    ctx.reply('Terjadi error saat memutar musik.');
  }
});

bot.action('info', async (ctx) => {
  try {
    await ctx.deleteMessage();
    await handleUserInfo(ctx, ctx.from);
  } catch (error) {
    console.error('error in info action:', error);
    ctx.reply('terjadi error.');
  }
});

bot.command('info', async (ctx) => {
  try {
    let target;
    if (ctx.message.reply_to_message) {
      target = ctx.message.reply_to_message.from;
    } else if (ctx.message.text.split(' ')[1]) {
      let username = ctx.message.text.split(' ')[1];
      if (!username.startsWith('@')) username = '@' + username;
      const chat = await ctx.telegram.getChat(username);
      target = chat;
    } else {
      target = ctx.message.from;
    }
    await handleUserInfo(ctx, target);
  } catch (error) {
    console.error('error in info command:', error);
    ctx.reply('gagal mengambil info user.');
  }
});

async function handleUserInfo(ctx, target) {
  try {
    const userId = target.id;
    const username = target.username ? `@${target.username}` : '(tidak ada)';
    const firstName = target.first_name || '-';
    const lastName = target.last_name || '';

    const photos = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
    const caption = `ID: <code>${userId}</code>\nUsername: ${username}\nNama: ${firstName} ${lastName}`.trim();

    if (photos.total_count > 0) {
      const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
      return ctx.replyWithPhoto(fileId, { caption, parse_mode: 'HTML' });
    }

    return ctx.reply(caption, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('error getting user info:', error);
    ctx.reply('gagal mengambil info user.');
  }
}

bot.action('chatgpt', async (ctx) => {
  try {
    await ctx.deleteMessage();
    await ctx.reply('Masukkan pertanyaan.');
    ctx.session = ctx.session || {};
    ctx.session.waitingForChatGPT = true;
  } catch (error) {
    console.error('error in chatgpt action:', error);
    ctx.reply('terjadi error.');
  }
});

bot.command('chatgpt', async (ctx) => {
  try {
    const q = ctx.message.text.replace('/chatgpt', '').trim();
    if (!q) return ctx.reply('Masukkan pertanyaan.');
    
    await ctx.sendChatAction('typing');

    const { data } = await axios.post(
      'https://aliicia.my.id/api/chatgpt',
      {
        message: `
Aturan format Jawaban:
- Gunakan Markdown Telegram sederhana (bold, bullet).
- Dilarang menggunakan tabel.
- Jika jawaban adalah penjelasan biasa, pakai teks + bullet/heading saja.
- Jika pertanyaan meminta atau membutuhkan kode (JS, HTML, CSS, dll), gunakan blok kode (\`\`\`) sesuai bahasa yang diminta.
- Jangan gunakan karakter aneh atau emoji berlebihan.
- Langsung To Point jawab pertanyaan, gausah sebut ulang promt dalam jawaban
- Jika ragu suatu teks aman untuk Markdown Gunakan Teks Biasa tanpa Markdown.
Fokus utama: jawaban HARUS aman dikirim ke Telegram tanpa error parse

Pertanyaan:
${q}
`
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    let answer = data?.response || 'gagal mendapatkan jawaban.';
    if (answer.length > 4096) {
      answer = answer.substring(0, 4000) + '\n\n... (pesan dipotong karena terlalu panjang)';
    }
    
    await ctx.reply(answer, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('error in chatgpt command:', error);
    ctx.reply('terjadi error.');
  }
});

bot.launch().then(() => {
  rainbowLog('Alicia Telegram Bot Started');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));