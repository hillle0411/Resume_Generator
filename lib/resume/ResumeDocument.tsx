import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Resume } from "./schema";

export const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 36, paddingHorizontal: 44, fontSize: 10.5, fontFamily: "Helvetica", lineHeight: 1.35 },

  name: { fontSize: 20, fontFamily: "Helvetica-Bold", textAlign: "center", letterSpacing: 0.5 },
  contactLine: { fontSize: 9.5, textAlign: "center", marginTop: 4, color: "#333333" },
  targetRole: { fontSize: 10, fontFamily: "Helvetica-Oblique", textAlign: "center", marginTop: 2 },

  section: { marginTop: 12 },
  sectionHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingBottom: 2,
    marginBottom: 6,
  },

  summaryText: { textAlign: "justify" },

  entry: { marginBottom: 8 },
  entryTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  entryMeta: { fontSize: 9.5, fontFamily: "Helvetica-Oblique", marginTop: 1, marginBottom: 3 },

  bulletRow: { flexDirection: "row", marginTop: 2 },
  bulletMark: { width: 10, fontSize: 10.5 },
  bulletText: { flex: 1, textAlign: "justify" },

  educationRow: { marginBottom: 4 },
  educationDegree: { fontFamily: "Helvetica-Bold" },

  skillsText: { textAlign: "justify" },
});

export default function ResumeDocument({ resume }: { resume: Resume }) {
  const contactParts = [resume.contact.location, resume.contact.email, resume.contact.linkedin].filter(Boolean);

  return (
    <Document>
      <Page style={styles.page} wrap>
        <Text style={styles.name}>{resume.name.toUpperCase()}</Text>
        {contactParts.length > 0 && <Text style={styles.contactLine}>{contactParts.join(" | ")}</Text>}
        {resume.targetRole ? <Text style={styles.targetRole}>{resume.targetRole}</Text> : null}

        {resume.summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Profile</Text>
            <Text style={styles.summaryText}>{resume.summary}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Experience</Text>
          {resume.experience.map((e, i) => (
            <View key={i} style={styles.entry} wrap={false}>
              <Text style={styles.entryTitle}>{e.title}</Text>
              <Text style={styles.entryMeta}>{`${e.company}  |  ${e.dates}`}</Text>
              {e.bullets.map((b, bi) => (
                <View key={bi} style={styles.bulletRow}>
                  <Text style={styles.bulletMark}>•</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Education</Text>
          {resume.education.map((ed, i) => (
            <View key={i} style={styles.educationRow}>
              <Text style={styles.educationDegree}>{ed.degree}</Text>
              <Text>{`${ed.institution}  |  ${ed.dates}`}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Skills</Text>
          <Text style={styles.skillsText}>{resume.skills.join("  •  ")}</Text>
        </View>
      </Page>
    </Document>
  );
}
