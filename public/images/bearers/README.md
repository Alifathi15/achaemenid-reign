# تصاویرِ کاراکترها (Bearers)

عکسِ هر کاراکتر رو با همین اسمِ فایل اینجا بذار — بازی خودکار پیداش می‌کنه، نیازی به تغییرِ کد نیست.

## قوانین
- اسمِ فایل = کلیدِ انگلیسیِ کاراکتر (ستونِ `bearer` توی اکسل)، با پسوندِ `.png` یا `.jpg`/`.jpeg`/`.webp`.
- برای حالت‌های فرعی (مثلِ `diplomat>dark`)، `>` رو با `_` جایگزین کن: فایل باید `diplomat_dark.png` باشه.
  - اگه فایلِ اختصاصیِ حالتِ فرعی رو نداری، فقط `diplomat.png` (کلیدِ پایه) رو بذار — همون موقتاً برای همه‌ی حالت‌های `diplomat>*` هم استفاده می‌شه.
- اندازه‌ی پیشنهادی: مربع یا نزدیک به مربع (کارت با `object-fit: cover` نمایشش می‌ده، پس لبه‌های اضافی بریده می‌شن).
- اگه فایلی برای یه کاراکتر نذاری، همون ایموجیِ 👑 به‌جاش نشون داده می‌شه — چیزی خراب نمی‌شه.

## لیستِ کاملِ ۳۷ کاراکترِ پایه (از bearers.json)
anyone, barbare, bird, black_bird, courtesan, diplomat, doctor, dog, dragon,
executioner, explorator, farmer, foreign_princess, fortune_teller, general,
ghost, homunculus, jester, lady, merchant, minstrel, monk, nobleman, nun,
painter, parker, priest, prince, prophet, queen, rival, skeleton, soldier,
spy, viking, werewolf, witch

(`anyone` تصویر لازم نداره — کارت‌هایی با این bearer نامِ کاراکتر یا تصویرِ اختصاصی نشون نمی‌دن.)

## حالت‌های فرعی که تویِ ۸۸۳ کارت استفاده شدن (اختیاری، اگه خواستی جدا طراحی کنی)
diplomat>dark, farmer>werewolf, homunculus>closed, jester>lost, jester>throw,
jester>won, lady>dark, prophet>fanzy, prophet>saint,
+ حدود ۳۰ حالتِ `dungeon>*` (برایِ مینی‌گیمِ سیاه‌چال — بعداً مستقل بررسی می‌شه)
