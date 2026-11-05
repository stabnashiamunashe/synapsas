/**
 * Application forms for the licence types, transcribed from local-authority paper forms (originally Municipality of Chitungwiza's; wording is standard across councils):
 *   - Shop Licence Act [Chapter 14:17] "Application for a new licence" (4 pages)
 *   - Municipality of Chitungwiza (Registration of Premises) By-laws
 *   - General Application Form (allocation of stands and other applications)
 * The applicant's name, ID, phone, email, stand, address, ward and description of the business are standard fields on
 * every application, so they are not repeated here. Field definitions use the same schema as workflow templates
 * (src/lib/types.ts FieldDef) and can be edited later under Licensing → Licence types, fees & forms.
 */
import type { FieldDef } from "../src/lib/types";

export interface LicenceForm { formTitle: string; legalBasis?: string; instructions?: string; kinds: string[]; fields: FieldDef[]; officeFields: FieldDef[] }

const YES_NO = ["Yes", "No"];

export const SHOP_LICENCE_FORM: LicenceForm = {
  formTitle: "Application for a new licence",
  legalBasis: "Shop Licence Act [Chapter 14:17]",
  kinds: ["NEW", "RENEWAL", "EXTENSION", "REMOVAL", "ALTERATION"],
  instructions: "Submit in duplicate. The grant of a licence does not relieve the holder from compliance with any other law relating to the business. Severe penalties are provided in the Act for any false statement in an application; in addition the licence may be cancelled. This application must be accompanied by: (a) the prescribed fee; (b) documents, plans, specifications and information required by the licensing authority; (c) proof that any other enactment relating to the business has been complied with, e.g. planning consent; (d) proof that intention to apply has been advertised (copies of newspaper advertisements). Where the application is for the alteration of a condition, attach a statement of reasons.",
  fields: [
    { key: "h_applicant", label: "2. Particulars of applicant", type: "heading", width: "full", helpText: "For a company or co-operative company give these particulars for each director; for a co-operative society, each member of the governing committee; for a partnership, each active or administering partner (attach a schedule)." },
    { key: "maidenName", label: "Maiden name (if applicable)", type: "text", width: "half" },
    { key: "isOwner", label: "Is or will the applicant be the owner of the trade or business?", type: "select", options: YES_NO, required: true, width: "half" },
    { key: "businessAddress", label: "Business address and telephone number", type: "text", required: true, width: "half" },
    { key: "residentialAddress", label: "Residential address and telephone number", type: "text", required: true, width: "half" },
    { key: "dateOfBirth", label: "Date of birth", type: "date", width: "third" },
    { key: "placeOfBirth", label: "Place of birth", type: "text", width: "third" },
    { key: "firstEntry", label: "Date and place of first entry into Zimbabwe (if born in another country)", type: "text", width: "third" },

    { key: "h_control", label: "3. Person in actual and effective control of the trade or business at the premises", type: "heading", width: "full", helpText: "Leave blank if the applicant will be in control." },
    { key: "controllerName", label: "Full name", type: "text", width: "half" },
    { key: "controllerMaidenName", label: "Maiden name", type: "text", width: "half" },
    { key: "controllerResidential", label: "Residential address", type: "text", width: "half" },
    { key: "controllerBusiness", label: "Business address", type: "text", width: "half" },
    { key: "controllerBirth", label: "Date and place of birth", type: "text", width: "half" },
    { key: "controllerFirstEntry", label: "Date and place of first entry into Zimbabwe (if born in another country)", type: "text", width: "half" },

    { key: "h_convictions", label: "4. Convictions", type: "heading", width: "full" },
    { key: "convicted", label: "Has any person named under 2 or 3 been convicted within the past five years of an offence referred to in section 19(2) of the Act, or of any other offence?", type: "select", options: YES_NO, required: true, width: "half" },
    { key: "convictionDetails", label: "Details of each conviction", type: "textarea", width: "full", visibleWhen: { field: "convicted", op: "eq", value: "Yes" } },

    { key: "h_trade", label: "6. Description of the trade or business", type: "heading", width: "full", helpText: "The name under which the business is conducted and the premises are given above." },
    { key: "goods", label: "Goods to be dealt in", type: "textarea", required: true, width: "full" },
    { key: "goodsClass", label: "Class or classes of goods (per the current Shop Licences (Class of Goods) Notice; if not classified, specify the goods)", type: "text", width: "full" },
    { key: "saleMethod", label: "Goods are or will be", type: "multiselect", options: ["Sold out of hand", "Sold by auction", "Sold from vending machines", "Let for hire"], required: true, width: "half" },
    { key: "traderType", label: "Trading as", type: "select", options: ["Retailer", "Wholesaler", "Both"], required: true, width: "half" },

    { key: "h_estate", label: "7. Sequestration", type: "heading", width: "full" },
    { key: "sequestrated", label: "Has the applicant's estate been sequestrated in Zimbabwe or elsewhere?", type: "select", options: YES_NO, required: true, width: "half" },
    { key: "rehabilitated", label: "If yes, has the applicant been rehabilitated?", type: "select", options: YES_NO, width: "half", visibleWhen: { field: "sequestrated", op: "eq", value: "Yes" }, helpText: "If not rehabilitated, attach the consent of the trustee to carry on the trade or business." },

    { key: "h_premises", label: "8. Situation of the premises", type: "heading", width: "full", helpText: "The new premises in the case of an extension or removal. If trading only from vending machines, see paragraph 10." },
    { key: "premisesArea", label: "The premises are", type: "select", options: ["Urban", "Rural (including communal land)"], required: true, width: "third" },
    { key: "township", label: "Township / suburb", type: "text", width: "third", visibleWhen: { field: "premisesArea", op: "eq", value: "Urban" } },
    { key: "buildingName", label: "Name of building", type: "text", width: "third", visibleWhen: { field: "premisesArea", op: "eq", value: "Urban" } },
    { key: "shopNo", label: "Office / shop number", type: "text", width: "third", visibleWhen: { field: "premisesArea", op: "eq", value: "Urban" } },
    { key: "floorNo", label: "Floor number", type: "text", width: "third", visibleWhen: { field: "premisesArea", op: "eq", value: "Urban" } },
    { key: "plotNo", label: "Number of the plot / farm", type: "text", width: "third", visibleWhen: { field: "premisesArea", op: "neq", value: "Urban" } },
    { key: "farmName", label: "Name of the farm / agricultural holding", type: "text", width: "third", visibleWhen: { field: "premisesArea", op: "neq", value: "Urban" } },
    { key: "miningLocation", label: "Registered number of any mining location (attach consents under section 179 of the Mines and Minerals Act)", type: "text", width: "third", visibleWhen: { field: "premisesArea", op: "neq", value: "Urban" } },
    { key: "communalSite", label: "Description of the site or property on communal land", type: "textarea", width: "full", visibleWhen: { field: "premisesArea", op: "neq", value: "Urban" } },

    { key: "h_building", label: "9. Premises not yet erected, or requiring additions or alterations", type: "heading", width: "full" },
    { key: "buildingStatus", label: "Status of the building", type: "select", options: ["Existing, no alterations needed", "Not yet erected", "Erected, additions or alterations required"], required: true, width: "half" },
    { key: "plansApproved", label: "Have the building plans been approved by the competent authority? State the approved use of the building.", type: "textarea", width: "full", visibleWhen: { field: "buildingStatus", op: "neq", value: "Existing, no alterations needed" } },
    { key: "completionPeriod", label: "Period required to complete the erection, additions or alterations", type: "text", width: "half", visibleWhen: { field: "buildingStatus", op: "neq", value: "Existing, no alterations needed" } },

    { key: "h_vending", label: "10. Vending machines", type: "heading", width: "full" },
    { key: "vendingMachines", label: "If trading only from vending machines, describe them and state where they will be situated", type: "textarea", width: "full" },

    { key: "h_other", label: "11. Other authorities", type: "heading", width: "full" },
    { key: "otherAuthorities", label: "Authorities required under any other law or by-law before the licence may be granted, issued or renewed (attach the authority or a certified copy)", type: "textarea", width: "full" },
    { key: "advertised", label: "Intention to apply has been advertised (attach copies of the advertisements)", type: "checkbox", width: "full" },
  ],
  officeFields: [
    { key: "registrationClass", label: "Registration of premises", type: "select", options: ["NA", "R", "C of O"], width: "third", helpText: "Municipality of Chitungwiza (Registration of Premises) By-laws" },
    { key: "registrationRef", label: "Registration reference", type: "text", width: "third" },
    { key: "yearEnding", label: "Licence year ending 31 December", type: "number", width: "third" },
    { key: "townPlanningReport", label: "Town planning report (new applications and change of ownership)", type: "textarea", width: "full" },
    { key: "ehoReport", label: "Report of the Environmental Health Officer", type: "textarea", width: "full" },
    { key: "ehoDate", label: "Date of EHO report", type: "date", width: "third" },
  ],
};

export const PREMISES_REGISTRATION_FORM: LicenceForm = {
  formTitle: "Application for registration of premises",
  legalBasis: "Municipality of Chitungwiza (Registration of Premises) By-laws",
  kinds: ["NEW", "RENEWAL", "CHANGE_OF_OWNERSHIP"],
  instructions: "Addressed to The Town Clerk, Municipality of Chitungwiza, Town House, Zengeza, Chitungwiza. Registration runs to 31 December of the licence year. New applications and changes of ownership are referred for a town planning report and a report by the Environmental Health Officer.",
  fields: [
    { key: "licenceType", label: "Type of licence the premises are registered for", type: "text", required: true, width: "half", placeholder: "e.g. General dealer, bottle store, butchery" },
    { key: "yearEnding", label: "Year ending 31 December", type: "number", required: true, width: "third", defaultValue: new Date().getFullYear() },
    { key: "postalAddress", label: "Applicant's postal address", type: "text", required: true, width: "full" },
  ],
  officeFields: [
    { key: "registrationClass", label: "NA / R / C of O", type: "select", options: ["NA", "R", "C of O"], width: "third" },
    { key: "registrationRef", label: "Ref", type: "text", width: "third" },
    { key: "townPlanningReport", label: "Town planning report request (new applications and change of ownership)", type: "textarea", width: "full" },
    { key: "ehoReport", label: "Report of the Environmental Health Officer", type: "textarea", width: "full" },
    { key: "ehoDate", label: "Date", type: "date", width: "third" },
  ],
};

export const GENERAL_APPLICATION_FORM: LicenceForm = {
  formTitle: "General application form",
  legalBasis: "Municipality of Chitungwiza",
  kinds: ["NEW"],
  instructions: "Excluding residential stands. For further details use the back of the sheet or attach a project proposal. Companies must attach the names of directors and a copy of the certificate of incorporation. The application fee is non-refundable. I certify that the information given is true and correct and that I have not withheld any information that may affect my application.",
  fields: [
    { key: "applicationFor", label: "1. Application for", type: "text", required: true, width: "full", placeholder: "e.g. Allocation of a commercial stand, lease of a council property, trading site" },
    { key: "h_details", label: "2. Details of applicant", type: "heading", width: "full", helpText: "Surname or company name, other names and the identity number are captured above." },
    { key: "dateOfBirth", label: "Date of birth", type: "date", width: "third" },
    { key: "maritalStatus", label: "Marital status", type: "select", options: ["Single", "Married", "Divorced", "Widowed"], width: "third" },
    { key: "spouseEmployer", label: "Spouse and employer", type: "text", width: "third" },
    { key: "postalAddress", label: "Postal address", type: "text", required: true, width: "half" },
    { key: "residentialAddress", label: "Residential address", type: "text", required: true, width: "half" },
    { key: "businessAddress", label: "Business address", type: "text", width: "half" },
    { key: "previousEmployer", label: "Previous employer and address", type: "text", width: "half" },
    { key: "phoneHome", label: "Telephone: home", type: "text", width: "third" },
    { key: "phoneBusiness", label: "Telephone: business", type: "text", width: "third" },
    { key: "sourceOfIncome", label: "Source of income", type: "text", required: true, width: "third" },
    { key: "tradeReferences", label: "Trade references", type: "table", width: "full", minRows: 0, maxRows: 2, columns: [
      { key: "nameBranch", label: "Name and branch", type: "text", required: true, width: 220 },
      { key: "accountNo", label: "Account number", type: "text", width: 160 },
      { key: "tel", label: "Telephone", type: "text", width: 140 },
    ] },
    { key: "bankers", label: "Name of bankers", type: "text", width: "half" },
    { key: "bankAccount", label: "Account number", type: "text", width: "half" },
    { key: "h_company", label: "In the case of companies", type: "heading", width: "full" },
    { key: "directors", label: "Names of directors", type: "textarea", width: "full", helpText: "Attach a copy of the certificate of incorporation." },
    { key: "h_lease", label: "Lease", type: "heading", width: "full" },
    { key: "hasLease", label: "Do you hold a valid lease?", type: "select", options: YES_NO, required: true, width: "third" },
    { key: "leaseNo", label: "Lease number", type: "text", width: "third", visibleWhen: { field: "hasLease", op: "eq", value: "Yes" } },
    { key: "leaseStand", label: "Stand number on the lease", type: "text", width: "third", visibleWhen: { field: "hasLease", op: "eq", value: "Yes" } },
  ],
  officeFields: [
    { key: "dateReceived", label: "Date application received", type: "date", width: "third" },
    { key: "applicationFee", label: "Application fee (non-refundable)", type: "currency", width: "third" },
    { key: "receiptNo", label: "Receipt number", type: "text", width: "third" },
    { key: "applicationNo", label: "Application number (GA/nn/year)", type: "text", width: "third" },
    { key: "allocationRef", label: "Allocation reference", type: "text", width: "third" },
  ],
};

export const LIQUOR_FORM: LicenceForm = {
  formTitle: "Application for a liquor licence",
  legalBasis: "Liquor Act [Chapter 14:12] and council by-laws",
  kinds: ["NEW", "RENEWAL", "CHANGE_OF_OWNERSHIP"],
  fields: [
    { key: "liquorKind", label: "Kind of licence", type: "select", options: ["Bottle store (off-premises)", "Bar / beer hall (on-premises)", "Restaurant (with meals)", "Night club", "Wholesale"], required: true, width: "half" },
    { key: "tradingHours", label: "Proposed trading hours", type: "text", required: true, width: "half", placeholder: "e.g. 10:00–22:00 Monday to Saturday" },
    { key: "liquorBoard", label: "Liquor Licensing Board approval reference", type: "text", width: "half" },
    { key: "policeClearance", label: "Police clearance obtained for all persons in control", type: "checkbox", width: "half" },
    { key: "nearbySchools", label: "Schools, churches or clinics within 500 m of the premises", type: "textarea", width: "full" },
  ],
  officeFields: [
    { key: "ehoReport", label: "Report of the Environmental Health Officer", type: "textarea", width: "full" },
    { key: "policeObjection", label: "Police objection received", type: "select", options: YES_NO, width: "third" },
  ],
};

export const FOOD_FORM: LicenceForm = {
  formTitle: "Application for a food handling certificate",
  legalBasis: "Public Health Act [Chapter 15:17] and council by-laws",
  kinds: ["NEW", "RENEWAL"],
  fields: [
    { key: "foodType", label: "Type of food business", type: "select", options: ["Restaurant / takeaway", "Butchery", "Bakery", "Tuckshop / kiosk", "Catering", "Food processing"], required: true, width: "half" },
    { key: "handlers", label: "Number of food handlers", type: "number", required: true, min: 1, width: "third" },
    { key: "waterSource", label: "Water supply", type: "select", options: ["Council reticulated", "Borehole", "Both"], width: "third" },
    { key: "refuse", label: "Refuse storage and disposal arrangements", type: "text", width: "full" },
  ],
  officeFields: [
    { key: "ehoReport", label: "Report of the Environmental Health Officer", type: "textarea", width: "full" },
    { key: "ehoDate", label: "Date of inspection", type: "date", width: "third" },
  ],
};

/** code → form; types without an entry keep an empty form (standard fields only). */
export const LICENCE_FORMS: Record<string, LicenceForm> = {
  SHP: SHOP_LICENCE_FORM,
  REG: PREMISES_REGISTRATION_FORM,
  GA: GENERAL_APPLICATION_FORM,
  LIQ: LIQUOR_FORM,
  FHP: FOOD_FORM,
};

/** Extra licence types introduced by the paper forms (created if missing). */
export const EXTRA_TYPES = [
  { code: "REG", name: "Registration of business premises", category: "Trading", fee: 60, validityMonths: 12, requiresInspection: true, deptCode: "HHS", requirements: ["Copy of national ID or company registration", "Proof of stand ownership or lease", "Current licence (renewals)"], description: "Annual registration of premises under the Registration of Premises By-laws, 1991; required alongside the trading licence." },
  { code: "GA", name: "General application (stands, leases, other)", category: "Land & property", fee: 20, validityMonths: 12, requiresInspection: false, deptCode: "TS", requirements: ["Copy of national ID", "Proof of income or bank statement", "Certificate of incorporation (companies)", "Project proposal (if applicable)"], description: "General application to the Board excluding residential stands: commercial and industrial stands, leases, trading sites and other requests. Application fee is non-refundable." },
];
