// Original miniature stories and lines; entirely local, with no API calls or database writes.
export const IDLE_STORY_MS = 5 * 60 * 1000;
export const STORY_READ_MS = 30000;
export const stories = [
  { title: '口袋里的备用伞', text: '放学时突然下雨，大雄站在走廊发愁。哆啦A梦从口袋里翻了半天，掏出来的不是什么神奇道具，只是一把普通的折叠伞。“上次你忘带，我就一直放着。”两个人挤在一把伞下回家，谁的肩膀都湿了一点，却一路都在笑。' },
  { title: '没用上的时光机', text: '考试没考好，大雄想坐时光机回到昨天重新复习。哆啦A梦拉着他在书桌前坐下：“与其回到昨天，不如把今天过好。”那天晚上他们一起把错题抄了一遍。第二周的小测，大雄多对了三道题。' },
  { title: '最后一个铜锣烧', text: '盘子里只剩最后一个铜锣烧。哆啦A梦盯着它看了很久，最后掰成两半，把大一点的那半推给了大雄。“分着吃的铜锣烧，好像特别甜。”大雄嘴里塞得满满的，用力点了点头。' },
  { title: '任意门的另一边', text: '大雄说想去看海，哆啦A梦打开任意门，门外却是一片安静的小公园。“道具也有累的时候嘛。”他们坐在秋千上，看夕阳把云染成橘子色。原来想看的不是海，只是想和谁一起看看远方。' },
  { title: '缩小灯和蚂蚁', text: '哆啦A梦用缩小灯把自己和大雄变得很小，跟着一队蚂蚁去搬饼干屑。小小的饼干屑对他们来说像一座山，可蚂蚁们一个接一个，慢慢就搬回了家。变回来以后，大雄把房间收拾干净了——一次只收一个角落。' },
  { title: '记不住也没关系', text: '记忆面包吃完了，大雄还是没背下那首诗。哆啦A梦说：“那我们一句一句来。”他们把诗写在小纸条上，贴在冰箱、门背和铅笔盒里。一个星期后，大雄念给妈妈听，一个字都没错。' },
  { title: '竹蜻蜓的午后', text: '风很轻的午后，哆啦A梦戴上竹蜻蜓，飞到屋顶上晒太阳。大雄也爬上来，两个人什么都不做，只是数着天上的云。有一朵像铜锣烧，有一朵像大雄的鼻子。那天的时间好像走得特别慢。' },
  { title: '修好的小玩具', text: '大雄的发条小车摔坏了，他难过得不想说话。哆啦A梦没有掏道具，而是找来螺丝刀，陪他一点点拆开、擦干净、再装回去。小车重新跑起来时有点歪，可大雄觉得，这比新买的还要好。' },
  { title: '雨天的约定', text: '雨一直下，原本要去的郊游取消了。哆啦A梦把被子搭成帐篷，在里面打开小手电，给大雄讲宇宙的故事。窗外的雨声沙沙响，帐篷里亮着一小团光。大雄说，下雨天的郊游也很好。' },
  { title: '慢慢来的早晨', text: '大雄又起晚了，急得袜子都穿反了。哆啦A梦递给他一片吐司：“先吃一口，再跑也来得及。”那天大雄还是迟到了一点点，但他记得出门前那口热乎乎的吐司，和身后那句“路上小心”。' },
];

const LINES = {
  shy: ['嘿嘿～', '干、干嘛戳我啦', '被发现了～'],
  tickle: ['哈哈哈好痒！', '别挠了别挠了～', '噗哈哈哈！'],
  rage: ['不许再戳啦！', '我要生气了哦！', '哼！'],
  pet: ['好舒服～', '再摸一下下～', '呼噜呼噜……'],
  dizzy: ['头好晕……', '世界在转圈圈……', '晃、晃晕了……'],
  surprised: ['哇！我没睡着！', '吓我一跳！', '诶？我在哪？'],
  wave: ['你好呀！', '嗨～', '今天也一起加油！'],
  copter: ['竹蜻蜓～出发！', '飞咯～', '去那边看看！'],
  door: ['任意门！', '下一站——那边！', '嘿咻，传送！'],
  scared: ['老、老鼠啊——！', '救命！有老鼠！', '呜哇——！'],
  feed: ['铜锣烧！最喜欢了！', '谢谢你～好甜！', '啊呜——好吃！'],
  complete: ['搞定啦！', '完成～', '数据库任务做完了！'],
  error: ['唔……出了点问题', '好像哪里不对……', '要不要打开数据库看看？'],
  sleep: ['Zzz……', '铜锣烧……嘿嘿……'],
};

export function pickLine(kind, random = Math.random) {
  const list = LINES[kind];
  return list ? list[Math.floor(random() * list.length) % list.length] : '';
}

export class StoryCarousel {
  constructor(now = () => Date.now(), random = Math.random) {
    this.now = now; this.random = random;
    this.current = null; this.last = -1; this.bag = [];
    this.pauses = new Set(); this.remaining = STORY_READ_MS;
    this.due = this.now() + IDLE_STORY_MS;
  }
  show(origin = 'manual') {
    if (!this.bag.length) {
      this.bag = stories.map((_, i) => i);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
      if (this.bag[this.bag.length - 1] === this.last) this.bag.reverse();
    }
    this.last = this.bag.pop();
    this.current = { ...stories[this.last], origin, id: this.last };
    this.remaining = STORY_READ_MS; this.until = this.now() + STORY_READ_MS;
    this.due = this.now() + IDLE_STORY_MS;
    return this.current;
  }
  dismiss() {
    this.current = null; this.pauses.clear();
    this.due = this.now() + IDLE_STORY_MS;
  }
  pause(reason) {
    if (!this.current || this.pauses.has(reason)) return;
    if (!this.pauses.size) this.remaining = Math.max(0, this.until - this.now());
    this.pauses.add(reason);
  }
  resume(reason) {
    if (!this.pauses.delete(reason) || this.pauses.size || !this.current) return;
    this.until = this.now() + Math.max(5000, this.remaining);
  }
  tick({ blocked, automatic = true }) {
    if (blocked) { if (this.current) this.dismiss(); else this.due = Math.max(this.due, this.now() + 60000); return; }
    if (!automatic && this.current?.origin === 'automatic') this.dismiss();
    if (this.current && !this.pauses.size && this.now() >= this.until) this.show(this.current.origin);
    if (!this.current && automatic && this.now() >= this.due) this.show('automatic');
  }
}
