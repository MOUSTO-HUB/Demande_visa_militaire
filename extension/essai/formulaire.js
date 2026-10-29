// Formulaire d'essai FICTIF, construit comme celui du site COVA (Vue 2 +
// Element UI) : il sert aux tests automatiques et à la page d'essai locale.
// Il ne reproduit pas le site officiel ; les vrais champs sont relevés par
// les agents avec le bouton « Relever les champs de cette page ».

export const GABARIT = `
<el-form ref="formulaire" :model="demande" :rules="regles" label-width="220px">
  <el-form-item label="Nom de famille" prop="passeport.nom">
    <el-input v-model="demande.passeport.nom"></el-input>
  </el-form-item>
  <el-form-item label="Prénom(s)" prop="passeport.prenoms">
    <el-input v-model="demande.passeport.prenoms"></el-input>
  </el-form-item>
  <el-form-item label="Autres noms" prop="ancienNom">
    <el-input v-model="demande.ancienNom"></el-input>
  </el-form-item>
  <el-form-item label="Sexe" prop="sexe">
    <el-select v-model="demande.sexe" placeholder="Choisir">
      <el-option :value="1" label="Masculin"></el-option>
      <el-option :value="2" label="Féminin"></el-option>
    </el-select>
  </el-form-item>
  <el-form-item label="Date de naissance" prop="naissance">
    <el-date-picker v-model="demande.naissance" type="date" value-format="yyyy-MM-dd"></el-date-picker>
  </el-form-item>
  <el-form-item label="Nationalité actuelle" prop="nationalite">
    <el-select v-model="demande.nationalite" filterable>
      <el-option v-for="p in pays" :key="p.code" :value="p.code" :label="p.nom"></el-option>
    </el-select>
  </el-form-item>
  <el-form-item label="Situation familiale" prop="etatCivil">
    <el-radio-group v-model="demande.etatCivil">
      <el-radio label="S">Célibataire</el-radio>
      <el-radio label="M">Marié(e)</el-radio>
    </el-radio-group>
  </el-form-item>
  <el-form-item v-if="demande.etatCivil === 'M'" label="Nom du conjoint" prop="conjoint">
    <el-input v-model="demande.conjoint"></el-input>
  </el-form-item>
  <el-form-item label="Numéro du formulaire JW202" prop="jw">
    <el-input v-model="demande.jw"></el-input>
  </el-form-item>
  <el-form-item label="Email" prop="email">
    <el-input v-model="demande.email"></el-input>
  </el-form-item>
  <el-form-item label="Avez-vous servi dans les forces armées ?" prop="militaire">
    <el-checkbox v-model="demande.militaire">Oui</el-checkbox>
  </el-form-item>
</el-form>`;

const requis = { required: true, message: 'Obligatoire', trigger: 'change' };

export const definition = {
  data() {
    return {
      demande: {
        passeport: { nom: '', prenoms: '' },
        ancienNom: '',
        sexe: null,
        naissance: '',
        nationalite: '',
        etatCivil: '',
        conjoint: '',
        jw: '',
        email: '',
        militaire: false,
      },
      pays: [
        { code: 'GIN', nom: 'GUINEA (几内亚)' },
        { code: 'GNB', nom: 'GUINEA-BISSAU (几内亚比绍)' },
        { code: 'SEN', nom: 'SENEGAL (塞内加尔)' },
      ],
      regles: {
        'passeport.nom': [requis],
        'passeport.prenoms': [requis],
        sexe: [requis],
        naissance: [requis],
        nationalite: [requis],
        etatCivil: [requis],
        conjoint: [requis],
        jw: [requis],
      },
    };
  },
  template: GABARIT,
};
