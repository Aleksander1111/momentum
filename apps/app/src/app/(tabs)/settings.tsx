import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PutSettings, Settings as SettingsT } from '@momentum/contract';
import { api } from '../../lib/api';
import { C, F, useWide } from '../../ui/theme';
import { Chevron, List, Row, RowText, Sect } from '../../ui/parts';

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
          backgroundColor: C.white,
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

/** Row with a chevron that opens a text editor for its value beneath it; saves when editing ends. */
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
  return (
    <>
      <Row first={first} onPress={() => setOpen((o) => !o)}>
        <RowText title={title} sub={sub} />
        <Chevron open={open} />
      </Row>
      {open ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            onBlur={commit}
            multiline
            autoFocus
            style={[
              {
                borderWidth: 1,
                borderColor: C.line,
                borderRadius: 12,
                paddingVertical: 11,
                paddingHorizontal: 14,
                fontSize: 15,
                lineHeight: 21,
                minHeight: 120,
                color: C.ink,
                fontFamily: F.body,
                textAlignVertical: 'top',
              },
              noOutline,
            ]}
          />
        </View>
      ) : null}
    </>
  );
}

export default function Settings() {
  const wide = useWide();
  const qc = useQueryClient();
  const { data: s } = useQuery({ queryKey: ['settings'], queryFn: api.settings });
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
      <Sect first>Included projects</Sect>
      <List>
        {s.projects.map((p, i) => (
          <Row key={p.name} first={i === 0}>
            <RowText title={p.name} sub={p.path} />
            <Switch
              on={p.enabled}
              onToggle={() => {
                const projects = s.projects.map((x) => (x.name === p.name ? { ...x, enabled: !x.enabled } : x));
                put({ projects: projects.map(({ name, enabled }) => ({ name, enabled })) }, { projects });
              }}
            />
          </Row>
        ))}
      </List>

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
          <RowText title="Concurrent runs per project" />
          <Num
            value={s.agents.concurrentPerProject}
            onSave={(concurrentPerProject) => {
              const agents = { ...s.agents, concurrentPerProject };
              put({ agents }, { agents });
            }}
          />
        </Row>
        <Row>
          <RowText title="Concurrent runs in total" />
          <Num
            value={s.agents.concurrentTotal}
            onSave={(concurrentTotal) => {
              const agents = { ...s.agents, concurrentTotal };
              put({ agents }, { agents });
            }}
          />
        </Row>
      </List>
    </ScrollView>
  );
}
