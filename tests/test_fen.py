# Faithful Python port of the NEW FenBuilder.swift + FenValidator.swift logic.

class FenBuilder:
    def __init__(self):
        self.reset()
    def reset(self):
        self.wKm = self.bKm = False
        self.wRA1m = self.wRH1m = self.bRA8m = self.bRH8m = False
        self.lastEP = None
        self.hmc = 0
        self.lastGrid = None
        self.lastPly = -1
    def build(self, grid, side, ply):
        if self.isSP(grid):
            self.reset(); self.lastGrid = grid; self.lastPly = ply
        else:
            if self.lastGrid is not None and self.lastPly <= ply <= self.lastPly + 2:
                self.detect(self.lastGrid, grid)
            elif self.lastGrid is not None and ply > self.lastPly + 2:
                self.lastEP = None; self.hmc = 0
            self.lastGrid = grid; self.lastPly = ply
        b = self.board_fen(grid); c = self.castling(grid)
        ep = self.lastEP or "-"; fm = max(1, ply // 2 + 1)
        return f"{b} {side} {c} {ep} {self.hmc} {fm}"
    def detect(self, old, new):
        ch = []
        for r in range(8):
            for c in range(8):
                if old[r][c] != new[r][c]:
                    ch.append((r, c, old[r][c], new[r][c]))
        if not ch: return
        for (r, c, b, a) in ch:  # before=b, after=a
            if a == "K" and b == "." and r == 7 and c == 4: self.wKm = True
            if a == "k" and b == "." and r == 0 and c == 4: self.bKm = True
            if a == "R" and b == ".":
                if r == 7 and c == 0: self.wRA1m = True
                if r == 7 and c == 7: self.wRH1m = True
            if a == "r" and b == ".":
                if r == 0 and c == 0: self.bRA8m = True
                if r == 0 and c == 7: self.bRH8m = True
            if b != "." and a != b:
                if r == 7 and c == 0: self.wRA1m = True
                if r == 7 and c == 7: self.wRH1m = True
                if r == 0 and c == 0: self.bRA8m = True
                if r == 0 and c == 7: self.bRH8m = True
        self.lastEP = None
        frm = next((x for x in ch if x[3] != "." and x[2] == "."), None)   # arrived
        to = next((x for x in ch if x[2] != "." and x[2] != x[3]), None)   # left
        if frm and to:
            p = to[2]
            if p in "Pp" and abs(frm[0] - to[0]) == 2 and frm[1] == to[1]:
                epR = (frm[0] + to[0]) // 2
                self.lastEP = f"{chr(97 + to[1])}{8 - epR}"
            is_pawn = p in "Pp"
            is_cap = any(x[3] != "." and x[2] != "." and x[3] != x[2] for x in ch)
            self.hmc = 0 if (is_pawn or is_cap) else self.hmc + 1
    def isSP(self, g):
        return "".join(g[0]) == "rnbqkbnr" and "".join(g[1]) == "pppppppp" \
           and "".join(g[6]) == "PPPPPPPP" and "".join(g[7]) == "RNBQKBNR"
    def board_fen(self, g):
        rows = []
        for r in range(8):
            row, e = "", 0
            for c in range(8):
                ch = g[r][c]
                if ch == ".": e += 1
                else:
                    if e: row += str(e); e = 0
                    row += ch
            if e: row += str(e)
            rows.append(row)
        return "/".join(rows)
    def castling(self, g):
        s = ""
        if not self.wKm and not self.wRH1m and g[7][4] == "K" and g[7][7] == "R": s += "K"
        if not self.wKm and not self.wRA1m and g[7][4] == "K" and g[7][0] == "R": s += "Q"
        if not self.bKm and not self.bRH8m and g[0][4] == "k" and g[0][7] == "r": s += "k"
        if not self.bKm and not self.bRA8m and g[0][4] == "k" and g[0][0] == "r": s += "q"
        return s or "-"

def validate(fen):
    parts = fen.split(" ")
    if len(parts) < 4: return "not enough FEN fields"
    if parts[1] not in ("w", "b"): return "bad side-to-move field"
    if parts[2] != "-" and not all(ch in "KQkq" for ch in parts[2]): return "bad castling field"
    ranks = parts[0].split("/")
    if len(ranks) != 8: return "not 8 ranks"
    wK = bK = total = wP = bP = wT = bT = 0
    wkR = wkC = bkR = bkC = -1
    for rIdx, rank in enumerate(ranks):
        count = col = 0
        for ch in rank:
            if ch.isdigit():
                count += int(ch); col += int(ch); continue
            if ch not in "KQRBNPkqrbnp": return f"bad piece char {ch}"
            count += 1; col += 1; total += 1
            if ch.isupper(): wT += 1
            else: bT += 1
            if ch == "K": wK += 1; wkR, wkC = rIdx, col - 1
            if ch == "k": bK += 1; bkR, bkC = rIdx, col - 1
            if ch == "P":
                wP += 1
                if rIdx == 7: return "white pawn on rank 1"
            if ch == "p":
                bP += 1
                if rIdx == 0: return "black pawn on rank 8"
        if count != 8: return f"rank has {count} squares"
    if wK != 1: return f"{wK} white kings"
    if bK != 1: return f"{bK} black kings"
    if wP > 8: return f"{wP} white pawns"
    if bP > 8: return f"{bP} black pawns"
    if wT > 16: return f"{wT} white pieces"
    if bT > 16: return f"{bT} black pieces"
    if total < 4: return f"only {total} pieces"
    if total > 32: return f"{total} pieces"
    if wkR >= 0 and bkR >= 0 and abs(wkR - bkR) <= 1 and abs(wkC - bkC) <= 1:
        return "kings adjacent"
    return None

# ---------- helpers ----------
def start_grid():
    g = [["." for _ in range(8)] for _ in range(8)]
    back = "rnbqkbnr"
    for i, p in enumerate(back): g[0][i] = p; g[7][i] = p.upper()
    for i in range(8): g[1][i] = "p"; g[6][i] = "P"
    return g

def apply_move(g, uci):
    g = [row[:] for row in g]
    f, t = uci[0:2], uci[2:4]
    fc, fr = ord(f[0]) - 97, 8 - int(f[1])
    tc, tr = ord(t[0]) - 97, 8 - int(t[1])
    piece = g[fr][fc]
    g[fr][fc] = "."
    if uci[4:5] == "q": piece = "Q" if piece.isupper() else "q"
    g[tr][tc] = piece
    return g

fails = 0
def check(label, cond, detail=""):
    global fails
    print(("  PASS " if cond else "  FAIL ") + label + ("" if cond else " — " + str(detail)))
    if not cond: fails += 1

print("FenBuilder tests")
fb = FenBuilder()
g0 = start_grid()
f0 = fb.build(g0, "w", 0)
check("start FEN", f0 == "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", f0)
g1 = apply_move(g0, "e2e4"); f1 = fb.build(g1, "b", 1)
check("after e2e4: ep=e3, hmc=0", f1 == "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", f1)
g2 = apply_move(g1, "e7e5"); f2 = fb.build(g2, "w", 2)
check("after e7e5: ep=e6, fm=2", f2 == "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", f2)
g3 = apply_move(g2, "g1f3"); f3 = fb.build(g3, "b", 3)
check("after Nf3: ep=-, hmc=1", f3 == "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", f3)
# ply jump (missed frames): ep must clear, hmc reset
g7 = g3
for u in ["b8c6", "f1b5", "a7a6", "b5a4"]:
    g7 = apply_move(g7, u)
f7 = fb.build(g7, "b", 7)
check("ply jump +4: ep=-, hmc=0", " - 0 " in f7, f7)
# castling loss via king move
fb2 = FenBuilder(); fb2.build(start_grid(), "w", 0)
ga = apply_move(start_grid(), "e1e2")
fa = fb2.build(ga, "b", 1)
check("white king moved: castling=kq only", fa.split(" ")[2] == "kq", fa)
fb3 = FenBuilder(); fb3.build(start_grid(), "w", 0)
gb = apply_move(start_grid(), "h1h2")
fb3.build(gb, "b", 1)   # h1 rook left
gc = apply_move(gb, "h1h2".replace("h", "x"), ) if False else apply_move(gb, "h8h7")  # black rook h8 leaves too? h8->h7
fc_ = fb3.build(gc, "w", 2)
check("both h-rooks left: castling=Qq", fc_.split(" ")[2] == "Qq", fc_)

print("FenValidator tests")
check("start valid", validate("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") is None)
check("mirrored start is structurally legal (prevented at reader level, not here)", validate("RNBQKBNR/PPPPPPPP/8/8/8/8/pppppppp/rnbqkbnr w KQkq - 0 1") is None)
check("white pawn on rank 1 rejected", validate("rnbqkbnr/pppppppp/8/8/8/8/8/PNBQKBNR w KQkq - 0 1") is not None)
check("9 pawns rejected", validate("rnbqkbnr/pppppppp/8/8/8/P7/PPPPPPPP/RNBQKBNR w KQkq - 0 1") is not None)
check("adjacent kings rejected", validate("8/8/8/8/8/7P/kK6/8 w - - 0 1") is not None)
check("kings far apart ok", validate("k7/8/8/8/8/8/K5PP/8 w - - 0 1") is None)
check("bad side field rejected", validate("4k3/8/8/8/8/8/8/4K3 x - - 0 1") is not None)
check("bad castling rejected", validate("4k3/8/8/8/8/8/8/4K3 w KZ - 0 1") is not None)
check("17 white pieces rejected", validate("4k3/8/8/8/8/P7/PPPPPPPP/RNBQKBNR w - - 0 1") is not None)
check("2 white kings rejected", validate("4k3/8/8/8/8/8/8/3KK3 w - - 0 1") is not None)

print("END-TO-END (old bug scenario): chess.com FLIPPED, playing black")
# NEW pipeline: reader sends ABSOLUTE grid; Swift does NOT mirror.
g = start_grid()
fb4 = FenBuilder()
fen = fb4.build(g, "b", 0)
check("FEN correct for black side (absolute grid)", validate(fen) is None and fen.startswith("rnbqkbnr/pppppppp"), fen)
# OLD pipeline simulation for contrast: Swift mirrored the absolute grid
old_grid = [[g[7 - r][7 - c] for c in range(8)] for r in range(8)]
old_fen = FenBuilder().board_fen(old_grid) + " b KQkq - 0 1"
check("old pipeline produced mirrored garbage (white at top)", old_fen.split("/")[1] == "PPPPPPPP" and old_fen != FenBuilder().board_fen(g) + " b KQkq - 0 1", old_fen)

print("\n" + ("ALL FEN TESTS PASSED ✅" if fails == 0 else f"{fails} FAILURES ❌"))
exit(0 if fails == 0 else 1)
