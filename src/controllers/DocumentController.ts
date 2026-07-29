import { ReactiveController, ReactiveControllerHost } from 'lit';
import { MnxDocument, MnxStructure } from '../types/mnx.ts';
import { documentRepository } from '../utils/indexedDbRepository.ts';
import { defaultScore } from '../utils/defaultScore.ts';
import { upgradeTabExtension } from '../utils/upgradeTabExtension.ts';

export class DocumentController implements ReactiveController {
  host: ReactiveControllerHost;
  currentDocument: MnxDocument | null = null;
  documentsList: Omit<MnxDocument, 'mnxJson'>[] = [];
  isLoading = false;
  private saveTimeout: number | null = null;

  constructor(host: ReactiveControllerHost) {
    (this.host = host).addController(this);
  }

  hostConnected() {
    this.initDefaultDocument();
  }

  hostDisconnected() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }

  async initDefaultDocument() {
    this.isLoading = true;
    this.host.requestUpdate();

    try {
      // No corpus score is seeded here. Importing one as a JSON module coupled
      // the client bundle to a path under server/ — the corpus is authored as
      // Guitar Pro and its .mnx.json is a regenerated artifact, so the build
      // must not depend on it. An empty repository falls through to
      // `defaultScore` below.
      const list = await documentRepository.list();

      this.documentsList = list;

      if (list.length === 0) {
        const newDoc: MnxDocument = {
          id: 'e-major-scale',
          name: 'E Major Scale (2 Octaves)',
          lastUpdated: Date.now(),
          mnxJson: defaultScore
        };
        await documentRepository.save(newDoc);
        this.currentDocument = newDoc;
        localStorage.setItem('last-opened-score-id', newDoc.id);
        this.documentsList = [
          { id: newDoc.id, name: newDoc.name, lastUpdated: newDoc.lastUpdated }
        ];
      } else {
        // Load last opened document if stored in localStorage, otherwise load House of the Rising Sun
        const lastOpenedId = localStorage.getItem('last-opened-score-id');
        let loadedDoc = null;
        if (lastOpenedId) {
          loadedDoc = await documentRepository.load(lastOpenedId);
        }
        if (!loadedDoc) {
          loadedDoc = await documentRepository.load('house-of-the-rising-sun');
        }
        this.currentDocument = loadedDoc || await documentRepository.load(list[0].id);
        if (this.currentDocument) {
          this.currentDocument = this.upgraded(this.currentDocument);
          localStorage.setItem('last-opened-score-id', this.currentDocument.id);
        }
      }
    } catch (e) {
      console.error('Failed to initialize DocumentController', e);
    } finally {
      this.isLoading = false;
      this.host.requestUpdate();
    }
  }

  /**
   * Upgrades documents saved with an older extension version — v1
   * (`_x.guitar` / TAB clefs / duplicated tab staff) or v2 (`_x.tab`,
   * `_x.section`) — to the current `_x.mnxLab` form on load, and persists the
   * upgrade so it runs once per doc.
   */
  private upgraded(doc: MnxDocument): MnxDocument {
    const upgradedJson = upgradeTabExtension(doc.mnxJson);
    if (upgradedJson === doc.mnxJson) return doc;
    console.log(`Upgraded document "${doc.name}" to extension v3`);
    const upgradedDoc = { ...doc, mnxJson: upgradedJson };
    documentRepository.save(upgradedDoc).catch(e =>
      console.error('Failed to persist tab extension upgrade', e)
    );
    return upgradedDoc;
  }

  async resetToDefaultScale() {
    if (this.currentDocument) {
      await this.updateScore(defaultScore);
    }
  }

  async loadDocument(id: string) {
    this.isLoading = true;
    this.host.requestUpdate();
    try {
      const doc = await documentRepository.load(id);
      if (doc) {
        this.currentDocument = this.upgraded(doc);
        localStorage.setItem('last-opened-score-id', id);
      }
    } catch (e) {
      console.error('Failed to load document', e);
    } finally {
      this.isLoading = false;
      this.host.requestUpdate();
    }
  }

  async updateScore(updatedScore: MnxStructure) {
    if (!this.currentDocument) return;

    this.currentDocument = {
      ...this.currentDocument,
      lastUpdated: Date.now(),
      mnxJson: JSON.parse(JSON.stringify(updatedScore)) // deep copy
    };
    this.host.requestUpdate();

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = window.setTimeout(async () => {
      if (this.currentDocument) {
        await documentRepository.save(this.currentDocument);
        const list = await documentRepository.list();
        this.documentsList = list;
        this.host.requestUpdate();
        console.log('Saved document to IndexedDB');
      }
    }, 1000);
  }

  async createNewScore(name: string) {
    this.isLoading = true;
    this.host.requestUpdate();
    try {
      const newDoc: MnxDocument = {
        id: 'score-' + Math.random().toString(36).slice(2, 11),
        name: name || 'Untitled',
        lastUpdated: Date.now(),
        mnxJson: {
          mnx: { version: 1 },
          global: {
            measures: [{ key: { fifths: 0 }, time: { count: 4, unit: 4 } }]
          },
          parts: [
            {
              id: 'part-1',
              name: 'Guitar',
              _x: {
                mnxLab: {
                  tab: {
                    tuning: [
                      { string: 1, pitch: { step: 'E', octave: 4 } },
                      { string: 2, pitch: { step: 'B', octave: 3 } },
                      { string: 3, pitch: { step: 'G', octave: 3 } },
                      { string: 4, pitch: { step: 'D', octave: 3 } },
                      { string: 5, pitch: { step: 'A', octave: 2 } },
                      { string: 6, pitch: { step: 'E', octave: 2 } }
                    ],
                    staffKind: 'both'
                  }
                }
              },
              measures: [
                {
                  clefs: [
                    { clef: { sign: 'G', staffPosition: -2, octave: -1 } }
                  ],
                  sequences: [
                    {
                      content: [
                        { duration: { base: 'whole' }, rest: {} }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      };
      await documentRepository.save(newDoc);
      this.currentDocument = newDoc;
      localStorage.setItem('last-opened-score-id', newDoc.id);
      const list = await documentRepository.list();
      this.documentsList = list;
    } catch (e) {
      console.error('Failed to create new score', e);
    } finally {
      this.isLoading = false;
      this.host.requestUpdate();
    }
  }
}
