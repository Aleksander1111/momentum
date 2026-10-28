import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View, type TextStyle } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { AutomationName, ProjectLogo as LogoSchema, Risk } from '@momentum/contract';
import type { GraphBuildMode, GraphBuildState, ModelChoice, ModelMode, ModelSettings, PutGraphBuild, PutSettings, Settings as SettingsT, Workspace } from '@momentum/contract';
import { api } from '../../lib/api';
import { pickLogo } from '../../lib/pickLogo';
import { automationLabel, durationMs, usagePct } from '../../lib/format';
import { C, F, useTheme, useWide, type Appearance } from '../../ui/theme';
import { Btn, Chevron, List, Row, RowText, Sect } from '../../ui/parts';
import { ProjectLogo } from '../../ui/ProjectLogo';
import { T } from '../../ui/Text';
import { DomainBadge } from '../../ui/domains';
import { useOpenEntity } from '../../ui/EntityRef';
import { MicButton } from '../../ui/MicButton';
import { useGrowingField } from '../../ui/Field';
import { useDictation, withHeard } from '../../lib/voice';

const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={{ width: 42, height: 24, borderRadius: 12, backgroundColor: on ? C.ok : C.line, flexShrink: 0 }}
    >
      <View
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: C.surface,
          boxShadow: '0 1px 2px rgba(0,0,0,.2)',
        }}
      />
    </Pressable>
  );
}

/** Editable number pill; saves a positive integer when editing ends. */
function Num({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number.parseInt(text, 10);
    if (Number.isInteger(n) && n > 0 && n !== value) onSave(n);
    else setText(String(value));
  };
  return (
    <TextInput
      value={text}
      onChangeText={(t) => setText(t.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType="number-pad"
      selectTextOnFocus
      style={[
        {
          marginLeft: 'auto',
          backgroundColor: C.card,
          borderRadius: 8,
          paddingVertical: 3,
          paddingHorizontal: 10,
          fontSize: 14,
          color: C.ink,
          fontFamily: F.body,
          textAlign: 'center',
          width: Math.max(3, text.length) * 9 + 22,
        },
        noOutline,
      ]}
    />
  );
}

/**
 * Row with a chevron that opens a text editor for its value beneath it; saves when editing ends. The mic in the editor
 * types what is said into it, saved as each stretch arrives.
 */
function TextRow({
  first,
  title,
  sub,
  value,
  onSave,
}: {
  first?: boolean;
  title: string;
  sub?: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    if (text.trim() && text !== value) onSave(text);
    else setText(value);
  };
  // What is said arrives with the field not focused, so nothing ends the editing: each stretch saves as it lands
  const current = useRef(text);
  current.current = text;
  const mic = useDictation((heard) => {
    const next = withHeard(current.current, heard);
    current.current = next;
    setText(next);
    if (next !== value) onSave(next);
  });
  const field = useRef<TextInput>(null);
  const shown = mic.listening ? withHeard(text, mic.partial) : text;
  // Five lines to ten, then it scrolls; it follows what the mic types
  const { height, ...grow } = useGrowingField(field, shown, 105, 210, mic.listening);
  return (
    <>
      <Row first={first} onPress={() => setOpen((o) => !o)}>
        <RowText title={title} sub={sub} />
        <Chevron open={open} />
      </Row>
      {open ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingTop: 11, paddingBottom: 9, paddingHorizontal: 14, gap: 6 }}>
            <TextInput
              ref={field}
              value={shown}
              onChangeText={setText}
              {...grow}
              onBlur={commit}
              multiline
              autoFocus
              editable={!mic.listening}
              style={[
                {
                  padding: 0,
                  fontSize: 15,
                  lineHeight: 21,
                  height,
                  color: C.ink,
                  fontFamily: F.body,
                  textAlignVertical: 'top',
                },
                noOutline,
              ]}
            />
            <View style={{ alignSelf: 'flex-end' }}>
              <MicButton bare listening={mic.listening} available={mic.available} onPress={mic.listening ? mic.stop : mic.start} />
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}

/** Segmented choice; stretch fills the width with equal segments instead of sitting at the row's end. */
function Segmented<V extends string>({
  options,
  value,
  onChange,
  stretch,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  stretch?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        marginLeft: stretch ? undefined : 'auto',
        flex: stretch ? 1 : undefined,
        flexDirection: 'row',
        backgroundColor: C.card,
        borderRadius: 8,
        padding: 2,
        flexShrink: 0,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={{
              flex: stretch ? 1 : undefined,
              alignItems: 'center',
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 6,
              backgroundColor: on ? C.surface : 'transparent',
              boxShadow: on ? '0 1px 2px rgba(0,0,0,.15)' : undefined,
            }}
          >
            <T style={{ fontSize: 13.5, fontWeight: on ? '700' : '400', color: on ? C.ink : C.muted }}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

const APPEARANCES: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Colour scheme; kept on this device, not on the server. */
function AppearancePicker() {
  const { appearance, setAppearance } = useTheme();
  return <Segmented options={APPEARANCES} value={appearance} onChange={setAppearance} />;
}

const MODES: { value: ModelMode; label: string }[] = [
  { value: 'single', label: 'One model' },
  { value: 'per_automation', label: 'Per automation' },
  { value: 'risk', label: 'By risk' },
];

const MODELS: { value: ModelChoice; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'fable', label: 'Fable' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' },
];

const modelLabel = (m: ModelChoice) => MODELS.find((x) => x.value === m)!.label;

/** Row showing a model; opens the choice beneath it. */
function ModelRow({
  first,
  title,
  value,
  onSave,
}: {
  first?: boolean;
  title: string;
  value: ModelChoice;
  onSave: (m: ModelChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Row first={first} onPress={() => setOpen((o) => !o)}>
        <RowText title={title} sub={modelLabel(value)} />
        <Chevron open={open} />
      </Row>
      {open ? (
        <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 12 }}>
          <Segmented stretch options={MODELS} value={value} onChange={onSave} />
        </View>
      ) : null}
    </>
  );
}

/**
 * The model runs start on: one for all, one per automation, or by risk, where an implementation's risk is estimated
 * from the user's rules just before it starts and every other automation keeps its own model.
 */
function Models({ m, onSave }: { m: ModelSettings; onSave: (m: ModelSettings) => void }) {
  const automations = AutomationName.options.filter((a) => m.mode === 'per_automation' || a !== 'implementation');
  return (
    <List>
      <Row first>
        <Segmented stretch options={MODES} value={m.mode} onChange={(mode) => onSave({ ...m, mode })} />
      </Row>
      {m.mode === 'single' ? (
        <ModelRow title="All runs" value={m.single} onSave={(single) => onSave({ ...m, single })} />
      ) : null}
      {m.mode === 'risk'
        ? Risk.options.map((r) => (
            <ModelRow
              key={r}
              title={`Implementation, ${r} risk`}
              value={m.risk[r]}
              onSave={(choice) => onSave({ ...m, risk: { ...m.risk, [r]: choice } })}
            />
          ))
        : null}
      {m.mode !== 'single'
        ? automations.map((a) => (
            <ModelRow
              key={a}
              title={automationLabel(a)}
              value={m.perAutomation[a]}
              onSave={(choice) => onSave({ ...m, perAutomation: { ...m.perAutomation, [a]: choice } })}
            />
          ))
        : null}
    </List>
  );
}

/** Opens the explorer on a workspace with the tree open down to a folder, such as its triggers */
const openFolder = (ws: string, folder: string) => router.navigate({ pathname: '/explorer', params: { ws, folder } });

/** A row that leads into the knowledge graph, where a piece of the configuration is an entity changed and approved as any other */
function GraphRow({ first, type, title, sub, onPress }: { first?: boolean; type: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Row first={first} onPress={onPress}>
      <DomainBadge type={type} />
      <RowText title={title} sub={sub} />
      <Chevron />
    </Row>
  );
}

/**
 * The configuration that is not set here: the automation definitions, the entity types, the risk rules and, per
 * project, the triggers and the patterns of the user's behaviour live as entities in the knowledge graph, where a
 * change is proposed and approved like any other. Each row opens where it lives.
 */
function InTheGraph({ harness, projects }: { harness: string; projects: string[] }) {
  const open = useOpenEntity(harness);
  return (
    <List>
      <GraphRow
        first
        type="Harness/Automation"
        title="Automations"
        sub={`What each automation does, the search answers included; in ${harness}`}
        onPress={() => openFolder(harness, 'Harness/Automation')}
      />
      <GraphRow
        type="Code/ConfigSetting"
        title="Entity types"
        sub="The types every entity takes, with what each is for"
        onPress={() => open?.('Code/ConfigSetting/entity-types')}
      />
      <GraphRow
        type="Harness/Automation"
        title="Risk rules"
        sub="How an implementation's risk is judged, among the artifacts of the Implementation definition"
        onPress={() => open?.('Harness/Automation/implementation')}
      />
      {projects.map((p) => (
        <Row key={p}>
          <ProjectLogo name={p} size={26} />
          <RowText title={p} sub="Its triggers and patterns" />
          <Btn small kind="ghost" label="Triggers" onPress={() => openFolder(p, 'Harness/Trigger')} />
          <Btn small kind="ghost" label="Patterns" onPress={() => openFolder(p, 'Harness/Pattern')} style={{ marginLeft: 6 }} />
        </Row>
      ))}
    </List>
  );
}

const GRAPH_BUILD: Record<GraphBuildState, string> = { building: 'building', stopped: 'stopped', complete: 'complete' };
/** How the build is paced: by the feed's room, or in full whatever the feed holds */
const GRAPH_BUILD_MODE: Record<GraphBuildMode, string> = { paced: 'paced by the feed', full: 'in full' };

/**
 * The logo of a project, shown on its cards: Upload picks an image (PNG, JPEG, WebP or SVG, at most 256 KB),
 * Remove goes back to the one drawn from the name.
 */
function LogoRow({ name, logo }: { name: string; logo: string | null }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const saved = (next: Workspace) => {
    setError(null);
    qc.setQueryData<Workspace[]>(['workspaces'], (ws) => ws?.map((w) => (w.name === name ? next : w)));
    void qc.invalidateQueries({ queryKey: ['workspaces'] });
    void qc.invalidateQueries({ queryKey: ['settings'] });
  };
  const upload = useMutation({
    mutationFn: async () => {
      const picked = await pickLogo();
      if (!picked) return null;
      const checked = LogoSchema.safeParse(picked);
      if (!checked.success) throw new Error(checked.error.issues[0]?.message ?? 'Not an image');
      return api.putProjectLogo(name, checked.data);
    },
    onSuccess: (next) => next && saved(next),
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });
  const remove = useMutation({ mutationFn: () => api.deleteProjectLogo(name), onSuccess: saved });
  const busy = upload.isPending || remove.isPending;
  const sub = error ?? (logo ? 'Uploaded' : 'Drawn from the name until one is uploaded');
  return (
    <Row style={{ paddingLeft: 28, backgroundColor: C.card }}>
      <RowText title="Logo" sub={sub} size={14} />
      <Btn small kind="ghost" label={logo ? 'Replace' : 'Upload'} disabled={busy} onPress={() => upload.mutate()} />
      {logo ? <Btn small kind="ghost" label="Remove" disabled={busy} onPress={() => remove.mutate()} style={{ marginLeft: 6 }} /> : null}
    </Row>
  );
}

/**
 * The knowledge graph build of a project: its state, how it is paced, what it produced and what it used, refreshed
 * while it builds; Stop ends the run in progress and keeps the next from starting, Resume queues it again. In full
 * has the build go on whatever the feed holds, each run writing without a limit, Paced has the feed's room pace it
 * again. Reset removes every entity and database entry of the project and builds the knowledge graph afresh; it asks
 * for a second tap first.
 */
function GraphBuildRow({ name }: { name: string }) {
  const qc = useQueryClient();
  const { data: m } = useQuery({
    queryKey: ['graph-build', name],
    queryFn: () => api.graphBuild(name),
    refetchInterval: (q) => (q.state.data?.state === 'building' ? 5_000 : 30_000),
  });
  const set = useMutation({
    mutationFn: (change: PutGraphBuild) => api.putGraphBuild(name, change),
    onSuccess: (next) => qc.setQueryData(['graph-build', name], next),
    onError: () => void qc.invalidateQueries({ queryKey: ['graph-build', name] }),
  });
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4_000);
    return () => clearTimeout(t);
  }, [armed]);
  const reset = useMutation({
    mutationFn: () => api.resetProject(name),
    onSuccess: (next) => {
      qc.setQueryData(['graph-build', name], next);
      // Every entity, chat, run and metric of the project is gone
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'graph-build' });
    },
    onSettled: () => setArmed(false),
  });
  if (!m?.state) return null;
  // Completeness as the harness measures it on the main line, and the full build extrapolated from what it took so far
  const c = m.completeness;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const slots = c.understanding.slots;
  const measured = [
    `${slots.filter((s) => s.filled).length} of ${slots.length} questions answered`,
    `${pct(c.territory.score)} of the repository accounted for`,
    ...(c.detail > 0 ? [`${c.detail} implementation-detail ${c.detail === 1 ? 'entity' : 'entities'}`] : []),
  ].join(' \u00b7 ');
  const cost = [
    { label: m.state === 'complete' ? 'Spent' : 'So far', ms: m.spentMs, usage: m.usage },
    ...(m.state === 'complete' || !m.estimate ? [] : [{ label: 'Full build \u2248', ms: m.estimate.totalMs, usage: m.estimate.usage }]),
  ];
  const missing = [...new Set([...slots.filter((s) => !s.filled).map((s) => s.name.toLowerCase()), ...c.territory.areas.filter((a) => a.score < 1).map((a) => a.path)])];
  const tone = reset.isPending ? C.muted : { building: C.accent, stopped: C.warn, complete: C.ok }[m.state];
  const small = { fontSize: 12.5, color: C.muted };
  const num: TextStyle = { fontSize: 12.5, width: 64, textAlign: 'right', fontVariant: ['tabular-nums'] };
  return (
    <Row style={{ paddingLeft: 28, backgroundColor: C.card, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 10, rowGap: 4 }}>
          <T style={{ fontSize: 14 }}>Knowledge graph</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: tone, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} />
            <T style={{ fontSize: 12, color: tone }}>{reset.isPending ? 'resetting' : GRAPH_BUILD[m.state]}</T>
          </View>
          <T style={small}>{GRAPH_BUILD_MODE[m.mode]}</T>
          <T style={small}>
            {m.runs} {m.runs === 1 ? 'run' : 'runs'} {'\u00b7'} {m.entities} {m.entities === 1 ? 'entity' : 'entities'}
          </T>
        </View>
        <View style={{ maxWidth: 420, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' }}>
              <View style={{ width: pct(Math.min(1, Math.max(0, c.score))) as `${number}%`, height: '100%', backgroundColor: m.state === 'complete' ? C.ok : C.accent }} />
            </View>
            <T style={{ fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{pct(c.score)} complete</T>
          </View>
          <T style={small}>{measured}</T>
        </View>
        <View style={{ maxWidth: 420 }}>
          <View style={{ flexDirection: 'row', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <T style={[small, { flex: 1 }]}>Cost</T>
            <T style={[num, small]}>Time</T>
            <T style={[num, small]}>5 h</T>
            <T style={[num, small]}>Week</T>
          </View>
          {cost.map((r) => (
            <View key={r.label} style={{ flexDirection: 'row', paddingTop: 3 }}>
              <T style={[small, { flex: 1 }]}>{r.label}</T>
              <T style={num}>{durationMs(r.ms)}</T>
              <T style={num}>{usagePct(r.usage.fiveHour)}</T>
              <T style={num}>{usagePct(r.usage.week)}</T>
            </View>
          ))}
        </View>
        {missing.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <T style={small}>Missing</T>
            {missing.map((x) => (
              <View key={x} style={{ backgroundColor: C.washWarn, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
                <T style={{ fontSize: 12, color: C.warn }}>{x}</T>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {m.state !== 'complete' && !armed ? (
        <Btn
          small
          kind="ghost"
          label={m.state === 'building' ? 'Stop' : 'Resume'}
          disabled={set.isPending || reset.isPending}
          onPress={() => set.mutate({ building: m.state !== 'building' })}
        />
      ) : null}
      {m.state !== 'complete' && !armed ? (
        <Btn
          small
          kind="ghost"
          label={m.mode === 'full' ? 'Pace' : 'In full'}
          disabled={set.isPending || reset.isPending}
          onPress={() => set.mutate({ mode: m.mode === 'full' ? 'paced' : 'full' })}
          style={{ marginLeft: 6 }}
        />
      ) : null}
      {m.resettable ? (
        <Btn
          small
          kind={armed ? 'primary' : 'ghost'}
          label={reset.isPending ? 'Resetting' : armed ? 'Confirm reset' : 'Reset'}
          disabled={reset.isPending || set.isPending}
          onPress={() => (armed ? reset.mutate() : setArmed(true))}
          style={{ marginLeft: 6 }}
        />
      ) : null}
    </Row>
  );
}

export default function Settings() {
  useTheme();
  const wide = useWide();
  const qc = useQueryClient();
  const { data: s, refetch } = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  // The project list stays folded under its heading until tapped open
  const [projectsShown, setProjectsShown] = useState(false);
  // The projects whose rows are open on their logo and knowledge graph build; opening one is separate from enabling it
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const toggleOpen = (name: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  // The tab stays mounted: coming back to it reads the projects as they are now, cloned or removed meanwhile
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const save = useMutation({
    mutationFn: (req: PutSettings) => api.putSettings(req),
    onSuccess: (next) => {
      qc.setQueryData(['settings'], next);
      void qc.invalidateQueries({ queryKey: ['workspaces'] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: () => void qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  if (!s) return null;

  const put = (req: PutSettings, optimistic: Partial<SettingsT>) => {
    qc.setQueryData<SettingsT>(['settings'], { ...s, ...optimistic });
    save.mutate(req);
  };

  return (
    <ScrollView
      contentContainerStyle={
        wide
          ? { maxWidth: 720, paddingVertical: 28, paddingHorizontal: 40 }
          : { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 }
      }
      keyboardShouldPersistTaps="handled"
    >
      <Sect first>Appearance</Sect>
      <List>
        <Row first>
          <RowText title="Theme" />
          <AppearancePicker />
        </Row>
      </List>

      <Pressable
        onPress={() => setProjectsShown((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: projectsShown }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <Sect>Included projects</Sect>
        <T style={{ fontSize: 13, color: C.muted, marginTop: 14, flex: 1 }}>
          {s.projects.filter((p) => p.enabled).length} of {s.projects.length} enabled
        </T>
        <Chevron open={projectsShown} style={{ marginTop: 14, marginRight: 8 }} />
      </Pressable>
      {projectsShown ? (
        <List>
          {s.projects.map((p, i) => (
            <View key={p.name}>
              <Row first={i === 0} onPress={() => toggleOpen(p.name)}>
                <ProjectLogo name={p.name} size={32} />
                <RowText title={p.name} sub={p.path} breakAnywhere />
                <Chevron open={opened.has(p.name)} />
                <Switch
                  on={p.enabled}
                  onToggle={() => {
                    const projects = s.projects.map((x) => (x.name === p.name ? { ...x, enabled: !x.enabled } : x));
                    put({ projects: projects.map(({ name, enabled }) => ({ name, enabled })) }, { projects });
                    void qc.invalidateQueries({ queryKey: ['graph-build', p.name] });
                  }}
                />
              </Row>
              {opened.has(p.name) ? <LogoRow name={p.name} logo={p.logo} /> : null}
              {opened.has(p.name) ? <GraphBuildRow name={p.name} /> : null}
            </View>
          ))}
        </List>
      ) : null}

      <Sect>Feed size</Sect>
      <List>
        <Row first>
          <RowText title="Items before loops pause" />
          <Num value={s.feedSize} onSave={(feedSize) => put({ feedSize }, { feedSize })} />
        </Row>
      </List>

      <Sect>Cards</Sect>
      <List>
        <Row first>
          <RowText title="Character limit" sub="Sized so a card fits on a mobile screen" />
          <Num
            value={s.cards.characterLimit}
            onSave={(characterLimit) => {
              const cards = { ...s.cards, characterLimit };
              put({ cards }, { cards });
            }}
          />
        </Row>
        <TextRow
          title="Presentation rules"
          value={s.cards.presentationRules}
          onSave={(presentationRules) => {
            const cards = { ...s.cards, presentationRules };
            put({ cards }, { cards });
          }}
        />
      </List>

      <Sect>Summarization</Sect>
      <List>
        <TextRow
          first
          title="Never summarized"
          sub={s.summarization.exclude.length ? s.summarization.exclude.join(', ') : 'One path pattern per line, such as **/*.lock'}
          value={s.summarization.exclude.join('\n')}
          onSave={(text) => {
            const summarization = { exclude: text.split('\n').map((l) => l.trim()).filter(Boolean) };
            put({ summarization }, { summarization });
          }}
        />
      </List>

      {s.lifetimes.length ? (
        <>
          <Sect>Lifetimes</Sect>
          <List>
            {s.lifetimes.map((l, i) => (
              <TextRow
                key={l.type}
                first={i === 0}
                title={l.type}
                sub={l.rule}
                value={l.rule}
                onSave={(rule) => {
                  const lifetimes = s.lifetimes.map((x, j) => (j === i ? { ...x, rule } : x));
                  put({ lifetimes }, { lifetimes });
                }}
              />
            ))}
          </List>
        </>
      ) : null}

      <Sect>Agents</Sect>
      <List>
        <Row first>
          <RowText title="Concurrent runs in total" sub="Automation runs go one at a time per project; runs you start go at once" />
          <Num
            value={s.agents.concurrentTotal}
            onSave={(concurrentTotal) => {
              const agents = { ...s.agents, concurrentTotal };
              put({ agents }, { agents });
            }}
          />
        </Row>
      </List>

      <Sect>Models</Sect>
      <Models m={s.models} onSave={(models) => put({ models }, { models })} />
      {s.models.mode === 'risk' ? (
        <T style={{ color: C.muted, fontSize: 12.5, marginTop: 8 }}>
          Risk rules: automations/implementation/risk.md in the harness, listed among the artifacts of the Implementation
          definition, under In the knowledge graph. Without them, implementation keeps its own model.
        </T>
      ) : null}

      <Sect>In the knowledge graph</Sect>
      <InTheGraph harness={s.harness.workspace} projects={s.projects.filter((p) => p.enabled).map((p) => p.name)} />

      <Sect>This device</Sect>
      <List>
        <Row first>
          <RowText title="Sign out" sub="Other devices stay signed in" />
          <Btn
            small
            kind="ghost"
            label="Sign out"
            onPress={async () => {
              await api.signOut();
              // Nothing of the projects stays on a device signed out
              qc.clear();
              router.replace('/session');
            }}
          />
        </Row>
      </List>
    </ScrollView>
  );
}
