export type NotebookInfographicTopicPreset = {
  id: string;
  label: string;
  topic: string;
};

export const NOTEBOOK_INFOGRAPHIC_TOPIC_PRESETS: NotebookInfographicTopicPreset[] =
  [
    {
      id: "rest-graphql",
      label: "REST vs GraphQL",
      topic: "REST APIs versus GraphQL for building web APIs",
    },
    {
      id: "sql-nosql",
      label: "SQL vs NoSQL",
      topic:
        "relational SQL databases versus NoSQL document and key-value stores",
    },
    {
      id: "sync-async",
      label: "Sync vs async code",
      topic:
        "synchronous versus asynchronous programming and when to use each",
    },
    {
      id: "organic-paid",
      label: "Organic vs paid social",
      topic:
        "organic social media reach versus paid advertising on social platforms",
    },
    {
      id: "mvp-full",
      label: "MVP vs full product",
      topic:
        "minimum viable product versus full-featured product launch strategy",
    },
    {
      id: "brand-performance",
      label: "Brand vs performance ads",
      topic:
        "brand awareness marketing versus performance and conversion marketing",
    },
    {
      id: "deep-multitask",
      label: "Deep work vs multitasking",
      topic: "deep focused work versus multitasking for productivity",
    },
    {
      id: "fixed-growth",
      label: "Fixed vs growth mindset",
      topic: "fixed mindset versus growth mindset in learning and careers",
    },
  ];
