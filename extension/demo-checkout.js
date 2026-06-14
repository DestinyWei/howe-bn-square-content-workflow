globalThis.checkoutDemo = {
  version: 2,
  source: "x-article",
  sourceUrl: "https://x.com/allscale_zh/status/2062444268653015186",
  title: "你点过上千次“立即支付”，但真的懂 Checkout 吗？",
  cover: "https://pbs.twimg.com/media/HJ9CXn1asAAgPQm?format=jpg&name=large",
  assets: [
    { url: "https://pbs.twimg.com/media/HJ9B81na0AALoP3?format=jpg&name=large" },
    { url: "https://pbs.twimg.com/media/HJ9B_FwakAEcxx2?format=jpg&name=large" },
    { url: "https://pbs.twimg.com/media/HJ9CEHgbwAAPOBN?format=jpg&name=large" },
    { url: "https://pbs.twimg.com/media/HJ9CJJzaEAAMB5u?format=jpg&name=large" }
  ],
  diagnostics: {
    sourceCharacters: 2028,
    extractedCharacters: 2028,
    coverage: 1,
    blockCount: 39
  },
  html: `
    <p>📌 这是「支付行业术语科普」系列第 1 篇，由全球首个自托管稳定币数字银行 AllScale <a href="https://x.com/@allscale_zh">@allscale_zh</a> 发布。整个系列将从最日常的产品功能讲起，逐步深入跨境支付、稳定币和合规牌照。完整术语手册（PDF）整理中，关注 <a href="https://x.com/allscale_zh">AllScale 华语</a> 后私信小编进群领取。</p>
    <hr>
    <p>打开购物网站，把东西丢进购物车，最后跳出一个填卡号、选支付方式、点“立即支付”的页面——这就是 <strong>Checkout</strong>，中文叫“收银台”。</p>
    <p>你可能用过上千次，但很少有人停下来想：这个页面到底是什么？它和“支付”是一回事吗？为什么有的网站结账丝滑，有的却让你卡在最后一步付不出去？</p>
    <p>这是支付科普系列的第一篇。我们从最熟悉的东西讲起，把整个支付世界的地基铺好。</p>

    <h2>一、Checkout 到底是什么</h2>
    <p><strong>Checkout 是商户提供给买家、用来完成这笔付款的那个界面或环节。</strong></p>
    <p>注意，它不等于“支付”本身。支付是钱真正流动的过程（之后会详细阐述），而 Checkout 只是承载这个动作的“入口”——就像超市门口的收银台，你在那儿结账，但钱具体怎么从你的卡跑到超市账户，是收银台背后一整套系统在跑。</p>
    <p>记住这个区分，后面会反复用到：</p>
    <ul>
      <li><strong>Checkout = 前台</strong>（你看得见的结账界面）</li>
      <li><strong>Gateway / Processor 等 = 后厨</strong>（你看不见的资金处理，留到第 4、5 篇拆解）</li>
    </ul>
    <p class="image-slot" data-asset-index="1">正文图片 1：请在币安编辑器中上传</p>

    <h2>二、Checkout 的三种常见形态</h2>
    <p>不是所有生意都有一个完整的购物网站。现实里，Checkout 主要有三种样子：</p>
    <ol>
      <li><strong>嵌入式收银台：</strong>直接集成在网站或 App 里，买家全程不用跳走。大平台标配。</li>
      <li><strong>Payment Link 支付链接：</strong>把收银台压缩成一条链接，复制发给对方，点开就能付。适合谁：没有独立网站的自由职业者、在社群里卖课卖货的、临时收一笔款的人。发一条链接到对方的微信或 WhatsApp，点开付钱，完事。</li>
      <li><strong>QR Code 扫码支付：</strong>把支付链接变成二维码，贴在桌上、打在屏幕上。线下场景如摊位、门店、活动现场等，扫一下就可以进行支付。</li>
    </ol>
    <p>三种本质是同一件事：<strong>尽量降低买家“付钱”这一步的摩擦</strong>。摩擦越小，成交率越高。这是收银台存在的全部意义。</p>
    <p class="image-slot" data-asset-index="2">正文图片 2：请在币安编辑器中上传</p>

    <h2>三、为什么传统 Checkout 经常“卡住”</h2>
    <p>你大概遇到过这些情况：</p>
    <ul>
      <li>填了一长串卡号、有效期、CVV，还要再做一次短信验证（这个叫 3DS，后面会专门讲）</li>
      <li>跨境买东西，结账时被悄悄加了一笔“货币转换费”</li>
      <li>你想买，但对方网站不支持你所在地区的银行卡，直接付不了</li>
    </ul>
    <p>这些摩擦的根源，是传统卡支付背后那套又长又旧的清算体系。买家点一下“支付”，背后要经过发卡行、卡组织、收单行好几道关卡——这个系列后面会一层一层拆给你看。</p>
    <p>现在你只需要记住一件事：<strong>收银台看起来简单，卡住你的从来不是这个页面，而是它背后的管道。</strong></p>
    <p class="image-slot" data-asset-index="3">正文图片 3：请在币安编辑器中上传</p>

    <h2>四、换一种 Checkout：以 AllScale 为例</h2>
    <p>如果买家用稳定币（比如 USDT、USDC）付款，Checkout 这一步会简单很多。以 AllScale Checkout 为例：</p>
    <p>买家这边：</p>
    <ol>
      <li>选择用稳定币支付</li>
      <li>连接钱包，或扫描二维码</li>
      <li>链上确认</li>
      <li>完成——通常几秒内到账</li>
    </ol>
    <p>商户这边：</p>
    <ul>
      <li>不用对接一堆银行和卡组织</li>
      <li><strong>自托管</strong>：收到的钱直接进自己掌控的钱包，不经过平台的账户中转</li>
    </ul>
    <p>（这里先不展开“自托管”为什么是关键——那是第 12 篇的主角。）</p>
    <p>把收银台塞进聊天框：AllScale TG Store</p>
    <p>回到本篇第二节的核心——收银台的本质是“降低买家付钱的摩擦”。顺着这条线往下推，接入主体可以越来越轻：</p>
    <blockquote>完整购物网站 → 一条支付链接 → 一张二维码 → <strong>干脆连页面都不要，把收银台塞进聊天软件里</strong></blockquote>
    <p>AllScale 的 TG Store（<a href="https://allscale.store">allscale.store</a>）就是最后这一步：<strong>你的 Telegram bot 本身就是店铺和收银台</strong>。买家在聊天里 /start、浏览、付款，全程不离开 Telegram，不用装任何 App。付的是 USDT/USDC，钱同样直接落到你自托管的钱包。</p>
    <p>它特别适合本来就在 Telegram 里做生意的人——卖数字商品、卖课、卖付费会员/信号群的。过去这些人要么被 Stripe、Gumroad、Patreon 抽掉一大块（8–12% 不等），要么卡在“你把 tx hash 发我、我手动拉你进群”的原始操作里。TG Store 把“收钱 + 自动发货/拉群”压成了聊天框里的一次点击。</p>
    <p>换句话说，Checkout 不一定是一个“页面”。当你的客户都在某个聊天软件里时，<strong>最好的收银台就是那个聊天软件本身</strong>。</p>
    <p class="image-slot" data-asset-index="4">正文图片 4：请在币安编辑器中上传</p>

    <h2>小结</h2>
    <p>Checkout 是你和“付钱”之间的那道门。门越好开，生意越好做。</p>
    <p>这一篇我们只讲了“前台”。下一篇讲 <strong>Invoicing（开票收款）</strong>——当你不是在卖现货，而是要给客户开一张账单、等对方按单付款时，事情会变成什么样，又会冒出哪些新角色。</p>`
};
