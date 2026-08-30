import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Resume } from "./schema";

export const styles = StyleSheet.create({
  page: { padding: 20, fontSize: 11 },
  header: { marginBottom: 8 },
  section: { marginBottom: 6 },
  bold: { fontWeight: 700 },
});

export default function ResumeDocument({ resume }: { resume: Resume }) {
  return (
    <Document>
      <Page style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={{ fontSize: 18, fontWeight: 700 }}>{resume.name}</Text>
          {resume.targetRole ? <Text>{resume.targetRole}</Text> : null}
        </View>

        {resume.summary ? (
          <View style={styles.section}>
            <Text style={styles.bold}>Summary</Text>
            <Text>{resume.summary}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.bold}>Experience</Text>
          {resume.experience.map((e, i) => (
            <View key={i}>
              <Text>{`${e.title} — ${e.company} (${e.dates})`}</Text>
              {e.bullets.map((b, bi) => (
                <Text key={bi}>• {b}</Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.bold}>Education</Text>
          {resume.education.map((ed, i) => (
            <Text key={i}>{`${ed.degree}, ${ed.institution} (${ed.dates})`}</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.bold}>Skills</Text>
          <Text>{resume.skills.join(", ")}</Text>
        </View>
      </Page>
    </Document>
  );
}
