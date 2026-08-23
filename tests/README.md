# اختبارات ChessHelper — Tests

اختبارات تحقق لمنطق قراءة اللوحة وبناء الـ FEN (النسخة 5.4).

## test_reader.js
يشتغل بـ Node.js (بدون أي مكتبات):
```bash
# استخرج reader.js من build.yml أولاً ثم استبدل الـ placeholders
sed -n "$(grep -n '(function(){if(window.__READER_FLAG__)return;' .github/workflows/build.yml | cut -d: -f1)p" .github/workflows/build.yml | sed 's/^          //' | sed 's/__BRIDGE_NAME__/b/g; s/__READER_FLAG__/f/g; s/__START_FUNC__/s/g; s/__READER_INTERVAL__/700/g' > /tmp/reader_check.js
node tests/test_reader.js
```
يغطي: chess.com عادي/مقلوب، lichess عادي/مقلوب (transform بنسبة وببكسل)، قراءة النقلات (e2e4/e7e5)، الدور الصحيح.

## test_fen.py
بورت Python مطابق لمنطق `FenBuilder.swift` + `FenValidator.swift`:
```bash
python3 tests/test_fen.py
```
يغطي: en-passant، عدّاد النقلات، حقوق التبييت، قفزات الـ ply، وكل فحوصات الـ Validator.

> لو عدّلت في FenBuilder/FenValidator/reader.js داخل build.yml — حدّث البورتات دي وشغّل الاختبارات قبل ما تعمل build.
