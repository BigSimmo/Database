import io,re,glob
LF=chr(10)

def expects(text):
    out=[]
    for m in re.finditer(r'\bexpect\(', text):
        i=m.end()-1; depth=0; j=i
        while j < len(text):
            c=text[j]
            if c=='(': depth+=1
            elif c==')':
                depth-=1
                if depth==0: break
            j+=1
        if j>=len(text): continue
        args=text[i+1:j]
        # FIRST ARGUMENT ONLY, split at a top-level comma (the second arg is the message).
        d=0; cut=len(args)
        for x,c in enumerate(args):
            if c in '([{': d+=1
            elif c in ')]}': d-=1
            elif c==',' and d==0: cut=x; break
        subject=re.sub(r'\s+',' ',args[:cut]).strip()
        k=text.find(';', j)
        out.append({'line':text.count(LF,0,m.start())+1,'subject':subject,'start':m.start(),
                    'end':(k+1 if k!=-1 else j+1),'stmt':text[m.start(): k+1 if k!=-1 else j+1]})
    return out

def is_exact(stmt):   return '.toBe(' in stmt and '.not.' not in stmt
def is_negative(stmt):return '.not.' in stmt

BOUNDARY=re.compile(r'\b(it|test|describe)\s*\(')
def scan(text):
    ex=expects(text); pairs=0; hits=[]
    for a,b in zip(ex,ex[1:]):
        if not a['subject'] or a['subject']!=b['subject']: continue
        # ⚠️ SAME TEST BLOCK ONLY. Two adjacent expects can sit in different it() blocks, where the
        # value is rebuilt between them and the second is genuinely live. Treating those as a dead
        # pair sends somebody to "fix" a working assertion.
        if BOUNDARY.search(text[a['end']:b['start']]): continue
        pairs+=1
        if is_exact(a['stmt']) and is_negative(b['stmt']):
            hits.append((b['line'],a['subject']))
    return len(ex),pairs,hits

BAD  = (LF+'describe("ctl", () => { it("x", () => {'+LF+
        '  expect(canaryValue).toBe("a");'+LF+
        '  expect(canaryValue, "named").not.toContain("b");'+LF+'}); });'+LF)
GOOD = (LF+'describe("ctl2", () => { it("y", () => {'+LF+
        '  expect(canaryOther, "named").not.toContain("b");'+LF+
        '  expect(canaryOther).toBe("a");'+LF+'}); });'+LF)
SPLIT = (LF+'describe("ctl3", () => {'+LF+
        '  it("p", () => { expect(canarySplit).toBe("a"); });'+LF+
        '  it("q", () => { expect(canarySplit, "named").not.toContain("b"); });'+LF+'});'+LF)

files=sorted(glob.glob('tests/ward-*.test.ts')+glob.glob('tests/ward-*.test.tsx'))
rows=[]; badctl=[]; allhits=[]
for f in files:
    t=io.open(f,encoding='utf-8').read()
    n,p,h=scan(t)
    raw=len(re.findall(r'\bexpect\(', t))
    _,_,hb=scan(t+BAD)     # SENSITIVITY: must find exactly one MORE
    _,_,hg=scan(t+GOOD)    # SPECIFICITY: must find exactly the SAME
    _,_,hs=scan(t+SPLIT)   # SPECIFICITY 2: a bad shape across test blocks must NOT be flagged
    ok = (n==raw) and (len(hb)==len(h)+1) and (len(hg)==len(h)) and (len(hs)==len(h))
    if not ok: badctl.append((f,n,raw,len(h),len(hb),len(hg)))
    if h:
        rows.append((f,n,p,len(h))); allhits.append((f,h))
print('files scanned:', len(files))
print('files with candidates:', len(rows))
print('total candidates:', sum(r[3] for r in rows))
print('CONTROL FAILURES (sensitivity or specificity or parse-count):', len(badctl))
for b in badctl: print('   ', b)
print()
print('%-56s %7s %6s %5s' % ('file','expects','pairs','found'))
for f,n,p,c in rows: print('%-56s %7d %6d %5d' % (f[6:],n,p,c))
det=[]
for f,h in allhits:
    t=io.open(f,encoding='utf-8').read(); ex=expects(t)
    for ln,sub in h:
        for a,b in zip(ex,ex[1:]):
            if b['line']==ln and a['subject']==sub:
                det.append('%s:%d%s  A: %s%s  B: %s' % (f[6:],ln,LF,re.sub(r'\s+',' ',a['stmt'])[:160],LF,re.sub(r'\s+',' ',b['stmt'])[:160]))
                break
io.open('dead-order-candidates.txt','w',encoding='utf-8').write((LF+LF).join(det))
print()
print('detail written; first few:')
for d in det[:8]: print(); print(d)
