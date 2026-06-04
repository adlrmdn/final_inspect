# DATA REPOSITORY (D365 & AWS Databases)

## Architectural Overview & Pretext

This unified data repository serves as the master blueprint for the VSM (Value Stream Mapping) Monitoring Platform. It maps the raw API endpoints from Microsoft Dynamics 365 (D365) and explains how they are transformed, cached, and optimized within our internal AWS PostgreSQL database.

### The Core Problem
D365 is a massive, slow-moving ERP system where data is highly fragmented across dozens of endpoints. A single garment style (`PLMActivity`) requires complex joins across Bill of Materials (`BillOfMaterialsVersions`), Production Groups (`ProductionGroupLinesItem`), and Factory Floor Jobs (`JobTransactionHeaders`) just to figure out its status. Querying this in real-time from a dashboard is impossible due to API limits and latency.

### The Solution & Relationship Flow
We built an autonomous synchronization engine that pulls this fragmented data, applies strict filtering (ignoring old 2024/2025 seasons), and builds a highly optimized relational structure locally.

Here is the exact data lineage (How everything connects):
1. **Design Phase (`plm_activity` & `plm_trans`)**: A new clothing style is born in D365 as a `PLMActivity`. It has many sub-tasks (`plm_trans`) like "Design", "Costing", and "BOM Creation". 
2. **Production Mapping (`production_group_lines`)**: Once the BOM is finalized, D365 creates a Production Group (e.g., `MPG/PRG/...`). Our engine actively hunts for this link by tracing `PLMTrans` -> `BillOfMaterialsVersions` -> `ProductionGroupLinesItem`. Once found, it saves the `ProductionGroup` directly onto the local `plm_activity` table and saves the exact quantities into `production_group_lines`.
3. **Procurement (`po_headers` & `po_lines`)**: Fabric and raw materials are ordered. These Purchase Orders (`po_lines`) are tied directly to the `PLMId`. 
4. **Factory Floor Execution (Shadowing)**: Once the raw materials arrive, the factory floor cuts and sews the garments, generating `JobTransactionHeaders` and `JobTransactionLines`. Because D365 often leaves the root `PLMActivity` status as "Started" forever, our engine uses the `plm_activity_shadowing` table to override the status. If the mapped Production Group has finished sewing, or if it has stalled for >180 days, the Shadowing table forcefully updates the dashboard status.

---

## Production Execution

### ProductionGroupLinesItem

**Full Columns**:
`dataAreaId`, `TOC_ProductionGroup`, `No`, `ItemId`, `Size`, `RetailVariantId`, `Qty`, `LineNum`, `BOMId`, `InventLocationId`, `ProdId`, `InventSiteId`

**Raw JSON Sample**:
```json
{
  "@odata.etag": "W/\"JzExNDgxNTA3NDMsNTYzNzE0NTMyNic=\"",
  "dataAreaId": "mpg",
  "TOC_ProductionGroup": "MPG/PRG/2312/000332",
  "No": 1,
  "ItemId": "2312000009769",
  "Size": "L",
  "RetailVariantId": "0000015663",
  "Qty": 262,
  "LineNum": 0,
  "BOMId": "MPG/BOM/2310/000217",
  "InventLocationId": "WH-FG-PML",
  "ProdId": "MPG/PRD/2401/000001",
  "InventSiteId": "MPG"
}
```

---

### ProductionGroupLinesRouting

**Full Columns**:
`dataAreaId`, `TOC_ProductionGroup`, `OprNum`, `TOC_JobTransactionId`, `PreviousOperation`, `OprId`, `PurchId`, `NextOperation`, `resource`, `PurchName`, `OprPriority`

**Raw JSON Sample**:
```json
{
  "@odata.etag": "W/\"JzMzNDcwMTMzMCw1NjM3MTQ1MzI2Jw==\"",
  "dataAreaId": "mpg",
  "TOC_ProductionGroup": "MPG/PRG/2312/000332",
  "OprNum": 1,
  "TOC_JobTransactionId": "MPG/JOB/2401/000001",
  "PreviousOperation": "",
  "OprId": "IN-Cut",
  "PurchId": "",
  "NextOperation": "IN-Sew",
  "resource": "Cutting",
  "PurchName": "",
  "OprPriority": "Primary"
}
```

---

## Costing & Strategy

### TOC_FinalRMPrices

**Full Columns**:
`dataAreaId`, `TOC_BOMFinalRM_IDLine`, `TOC_ItemIDLine`, `PRonFinalBOM`, `TOC_InventoryGroup`, `VendName`, `TOC_RefRecId`, `TOC_ActualPrice`, `MarginAmount`, `CreatedDateTimeLine`, `TOC_BOMFinalRM_ID`, `Margin`, `ModifiedDateTimeLine`, `TOC_Season`, `TOC_WorkflowStatus`, `TOC_BatchLine`, `ItemName`, `TOC_Rate`, `CreatedDateTimeHeader`, `TOC_VendAccount`, `UOM`, `PPNAmount`, `COGMFinal`, `TOC_ItemID`, `TOC_ProductCategory`, `PR`, `ModifiedDateTimeHeader`, `TOC_PLM_Id`, `TOC_GarmentPartName`, `TOC_Charges`, `TOC_Ratio`, `TOC_Consumption`, `COGSFinal`, `TOC_FormulaSiteID`, `TOC_FormulaName`, `TOC_MUBudget`, `TOC_PriceOriginal`, `TOC_Colour`, `LogReason`, `TOC_DTID`, `OrderQty`, `TOC_Upload`, `TOC_Efisiensi`, `TOC_InventoryType`, `TOC_Status_BOM_FinalRM`, `TOC_BOM_Precosting`, `TOC_RFQ_Combo`, `QtyPR`, `TOC_ItemName`, `DocumentStatus`, `TOC_Brand`, `TOC_RetailVariantId`, `TOC_Batch`, `TOC_SMV`, `TOC_Size`, `CreatedByLine`, `TOC_Price`, `PPN`, `TOC_Currency`, `TOC_QtyOrder`

**Raw JSON Sample**:
```json
{
  "@odata.etag": "W/\"JzE5NDUxODYxMzgsNTYzNzE0NjA3ODsxNDUyNDgyNzcsNTYzNzE1NDY2NTsxNjIwMDczMjcxLDU2Mzc0MDI3MzAn\"",
  "dataAreaId": "mpr",
  "TOC_BOMFinalRM_IDLine": "MPR/BFP/2403/000005",
  "TOC_ItemIDLine": "2403000002215",
  "PRonFinalBOM": "No",
  "TOC_InventoryGroup": "HANGTAG",
  "VendName": "",
  "TOC_RefRecId": 0,
  "TOC_ActualPrice": 380,
  "MarginAmount": 8617.540553,
  "CreatedDateTimeLine": "2025-08-29T18:09:44Z",
  "TOC_BOMFinalRM_ID": "MPR/BFP/2403/000005",
  "Margin": 0,
  "ModifiedDateTimeLine": "2025-08-28T19:11:41Z",
  "TOC_Season": "WINTER-24",
  "TOC_WorkflowStatus": "Draft",
  "TOC_BatchLine": "No",
  "ItemName": "HANGTAG MANZONE BASIC+TALI BEST BUY WHITE ALL SIZE TPI-001",
  "TOC_Rate": 0,
  "CreatedDateTimeHeader": "2025-06-05T21:10:49Z",
  "TOC_VendAccount": "",
  "UOM": "PCS",
  "PPNAmount": 6319.529739,
  "COGMFinal": 48832.7298,
  "TOC_ItemID": "2403000001795",
  "TOC_ProductCategory": "OB-SS`",
  "PR": "Yes",
  "ModifiedDateTimeHeader": "2026-03-02T05:49:38Z",
  "TOC_PLM_Id": "",
  "TOC_GarmentPartName": "",
  "TOC_Charges": 0,
  "TOC_Ratio": 1000,
  "TOC_Consumption": 1,
  "COGSFinal": 63769.800092,
  "TOC_FormulaSiteID": "MPG",
  "TOC_FormulaName": "UNIFORM KP OFFICE SHIRT LONG SLEEVE MAN Blue_Light",
  "TOC_MUBudget": 2.5,
  "TOC_PriceOriginal": 0,
  "TOC_Colour": "WHITE",
  "LogReason": "",
  "TOC_DTID": "",
  "OrderQty": 1000,
  "TOC_Upload": "No",
  "TOC_Efisiensi": 0,
  "TOC_InventoryType": "Accesories",
  "TOC_Status_BOM_FinalRM": "Created",
  "TOC_BOM_Precosting": "",
  "TOC_RFQ_Combo": "No",
  "QtyPR": 0,
  "TOC_ItemName": "Manzone Moy 2 Pink",
  "DocumentStatus": null,
  "TOC_Brand": "Manzone",
  "TOC_RetailVariantId": "",
  "TOC_Batch": "No",
  "TOC_SMV": 0,
  "TOC_Size": "",
  "CreatedByLine": "?",
  "TOC_Price": 380,
  "PPN": 0,
  "TOC_Currency": "",
  "TOC_QtyOrder": 1000
}
```

---

## Procurement

### TOC_PurchRequisitions

**Full Columns**:
`PurchReqId`, `BusinessJustification1`, `PriceUnit`, `RequisitionPurposeLine`, `ReasonRefRecId`, `PurchQty`, `PrePaymentDetails`, `CreatedDateTimeLine`, `SequenceNumber`, `ModifiedDateTimeLine`, `ProjTaxGroupId`, `ReceivingOperatingUnit`, `OnHold`, `PurchSupplierAuxId`, `RequiredDate`, `ProjTransId`, `CompanyInfoDefault_PartyNumber`, `VendAccount`, `TOC_PLM_ID`, `CreatedDateTimeHeader`, `IsWorkflowToBeResubmitted`, `ActivityNumber`, `TransDate`, `PurchRFQCaseId`, `RequisitionStatus`, `RequisitionPurpose`, `PurchMarkup`, `ItemIdNonCatalog`, `BudgetReservationLine_PSN`, `PurchReqName`, `LineAmount`, `LineRefId`, `Attention`, `LineNum`, `ModifiedDateTimeHeader`, `CFOPTable_BR`, `ProcurementCategory`, `ProjSalesPrice`, `TaxItemGroup`, `LineComplete`, `PurchReqType`, `toc_item_name`, `TOC_DataAreaPLM`, `CFPSTable_BR`, `VendQuoteNumber`, `CompanyInfoDefault_DataArea`, `ProjSalesUnitOfMeasure`, `PurchAgreement`, `ProjIdLine`, `PurchUnitOfMeasure`, `DeliveryPostalAddress`, `ExternalItemId`, `ProjLinePropertyId`, `InventLocationId`, `IsPurchaseOrderGenerationManual`, `ProjCategoryId`, `BuyingLegalEntity`, `LineType`, `HoldExplanation`, `PurchId`, `RFQRequirement`, `LinePercent`, `AssetGroup`, `TaxServiceCode_BR`, `PurchReqBusinessJustificationCodes_Reason`, `Name`, `URL`, `TaxGroup`, `PurchReqTable`, `Originator_PersonnelNumber`, `DirPerson_FK_PartyNumber`, `DeliveryName`, `ProjSalesCurrencyId`, `ItemId`, `RequisitionStatusLine`, `RequiredDateLine`, `PurchReqConsolidationStatus`, `AssetRuleQualifierOptionLocal`, `AssetRuleQualifierOption`, `PriceDiscountTransfer`, `PurchPrice`, `AccountingDistributionTemplate`, `TransDateLine`, `OverrideSalesTax`, `TOC_QtyFromBom`, `IsPrepayment`, `CreatedByLine`, `Requisitioner`, `SubmittedBy`, `LineDisc`, `SubmittedDateTime`, `ProjId`, `CurrencyCode`, `SalesPurchOperationType_BR`, `SourceDocumentLine`, `TOC_BomFinalId`

**Raw JSON Sample**:
```json
{
  "@odata.etag": "W/\"JzExNTI5MTAxODksNTYzNzE0NTMyNjsyNzY4MDIwMDIsNTYzNzE0NTMyNic=\"",
  "PurchReqId": "PR/24/01/00004",
  "BusinessJustification1": 5637144583,
  "PriceUnit": 1,
  "RequisitionPurposeLine": "Consumption",
  "ReasonRefRecId": 0,
  "PurchQty": 6,
  "PrePaymentDetails": "",
  "CreatedDateTimeLine": "2024-01-02T07:20:55Z",
  "SequenceNumber": 1,
  "ModifiedDateTimeLine": "2025-09-18T18:11:11Z",
  "ProjTaxGroupId": "",
  "ReceivingOperatingUnit": 5637157326,
  "OnHold": "No",
  "PurchSupplierAuxId": "",
  "RequiredDate": "2024-01-02T12:00:00Z",
  "ProjTransId": "",
  "CompanyInfoDefault_PartyNumber": "",
  "VendAccount": "",
  "TOC_PLM_ID": "",
  "CreatedDateTimeHeader": "2024-01-02T07:05:29Z",
  "IsWorkflowToBeResubmitted": "No",
  "ActivityNumber": "",
  "TransDate": "2024-01-02T12:00:00Z",
  "PurchRFQCaseId": "",
  "RequisitionStatus": "Closed",
  "RequisitionPurpose": "Consumption",
  "PurchMarkup": 0,
  "ItemIdNonCatalog": "",
  "BudgetReservationLine_PSN": 0,
  "PurchReqName": "Pengajuan Hotel (Perjalanan Dinas Pemalang)",
  "LineAmount": 3000000,
  "LineRefId": "fc6291f7-aefb-4d08-aa6a-b7b57165a7eb",
  "Attention": "",
  "LineNum": 1,
  "ModifiedDateTimeHeader": "2024-01-04T11:17:05Z",
  "CFOPTable_BR": 0,
  "ProcurementCategory": 5637145327,
  "ProjSalesPrice": 0,
  "TaxItemGroup": "ALL",
  "LineComplete": "No",
  "PurchReqType": "Purch",
  "toc_item_name": "Pemalang - Hotel / Penginapan",
  "TOC_DataAreaPLM": "",
  "CFPSTable_BR": 0,
  "VendQuoteNumber": "",
  "CompanyInfoDefault_DataArea": "",
  "ProjSalesUnitOfMeasure": 0,
  "PurchAgreement": 0,
  "ProjIdLine": "",
  "PurchUnitOfMeasure": 5637146076,
  "DeliveryPostalAddress": 5637144580,
  "ExternalItemId": "",
  "ProjLinePropertyId": "",
  "InventLocationId": "",
  "IsPurchaseOrderGenerationManual": "Yes",
  "ProjCategoryId": "",
  "BuyingLegalEntity": 5637145327,
  "LineType": "Item",
  "HoldExplanation": "",
  "PurchId": "MPG/PO/2401/00003",
  "RFQRequirement": "None",
  "LinePercent": 0,
  "AssetGroup": "",
  "TaxServiceCode_BR": "",
  "PurchReqBusinessJustificationCodes_Reason": "SERVICE",
  "Name": "Pemalang - Hotel / Penginapan",
  "URL": "",
  "TaxGroup": "",
  "PurchReqTable": 5637145326,
  "Originator_PersonnelNumber": "1210035",
  "DirPerson_FK_PartyNumber": "000012973",
  "DeliveryName": "PT Mega Putra Garment",
  "ProjSalesCurrencyId": "",
  "ItemId": "2312000100218",
  "RequisitionStatusLine": "Closed",
  "RequiredDateLine": "2024-01-02T12:00:00Z",
  "PurchReqConsolidationStatus": "None",
  "AssetRuleQualifierOptionLocal": 0,
  "AssetRuleQualifierOption": 0,
  "PriceDiscountTransfer": "UsePolicy",
  "PurchPrice": 500000,
  "AccountingDistributionTemplate": 0,
  "TransDateLine": "2024-01-02T12:00:00Z",
  "OverrideSalesTax": "No",
  "TOC_QtyFromBom": 0,
  "IsPrepayment": "No",
  "CreatedByLine": "Hendri.Priyanto",
  "Requisitioner": 5637149150,
  "SubmittedBy": "Hendri.Priyanto",
  "LineDisc": 0,
  "SubmittedDateTime": "2024-01-02T10:53:06Z",
  "ProjId": "",
  "CurrencyCode": "IDR",
  "SalesPurchOperationType_BR": 0,
  "SourceDocumentLine": 5637144609,
  "TOC_BomFinalId": ""
}
```

---

## Bill of Materials (BOM)

### BillOfMaterialsLinesV3

**Full Columns**:
`dataAreaId`, `BOMId`, `LineCreationSequenceNumber`, `ProductConfigurationId`, `SubstitutionPriority`, `PositionNumber`, `ConsumptionCalculationMethod`, `IsConsumedAtOperationComplete`, `LineNumber`, `ConsumptionCalculationConstant`, `ProductSizeId`, `ItemNumber`, `ProductVersionId`, `ConsumptionWarehouseId`, `ValidFromDate`, `ConsumptionSiteId`, `WillCostCalculationIncludeLine`, `SubBOMId`, `IsResourceConsumptionUsed`, `WillManufacturedItemInheritBatchAttributes`, `ProductUnitSymbol`, `SubstitutionGroupId`, `LineType`, `QuantityRoundingUpMultiples`, `PhysicalProductDepth`, `PhysicalProductHeight`, `VariableScrapPercentage`, `ValidToDate`, `PhysicalProductDensity`, `RoundingUpMethod`, `ConsumptionType`, `WillManufacturedItemInheritShelfLifeDates`, `WarehouseBomReleaseReservationRequirementRule`, `MaterialOverpickPercentage`, `QuantityDenominator`, `FlushingPrinciple`, `VendorAccountNumber`, `ProductColorId`, `CatchWeightQuantity`, `PhysicalProductWidth`, `RouteOperationNumber`, `ConfigurationGroupId`, `ConstantScrapQuantity`, `ProductStyleId`, `Quantity`, `SubRouteId`, `QMSAllowOverDispensing`, `QMSUnderDispensePercentage`, `QMSOverDispensePercentage`

**Raw JSON Sample**:
```json
{
  "@odata.etag": "W/\"JzEsNTYzNzYyMTU5Mic=\"",
  "dataAreaId": "mpg",
  "BOMId": "MPG/BOM/2410/000362",
  "LineCreationSequenceNumber": 2,
  "ProductConfigurationId": "",
  "SubstitutionPriority": 0,
  "PositionNumber": "",
  "ConsumptionCalculationMethod": "Formula0",
  "IsConsumedAtOperationComplete": "No",
  "LineNumber": 2,
  "ConsumptionCalculationConstant": 0,
  "ProductSizeId": "",
  "ItemNumber": "2312000100000",
  "ProductVersionId": "",
  "ConsumptionWarehouseId": "WH-PRD-PML",
  "ValidFromDate": "1900-01-01T12:00:00Z",
  "ConsumptionSiteId": "MPG",
  "WillCostCalculationIncludeLine": "Yes",
  "SubBOMId": "",
  "IsResourceConsumptionUsed": false,
  "WillManufacturedItemInheritBatchAttributes": "No",
  "ProductUnitSymbol": "PCS",
  "SubstitutionGroupId": "",
  "LineType": "Item",
  "QuantityRoundingUpMultiples": 0,
  "PhysicalProductDepth": 0,
  "PhysicalProductHeight": 0,
  "VariableScrapPercentage": 0,
  "ValidToDate": "1900-01-01T12:00:00Z",
  "PhysicalProductDensity": 0,
  "RoundingUpMethod": "No",
  "ConsumptionType": "Variable",
  "WillManufacturedItemInheritShelfLifeDates": "No",
  "WarehouseBomReleaseReservationRequirementRule": "AllowPartialReservation",
  "MaterialOverpickPercentage": 0,
  "QuantityDenominator": 1,
  "FlushingPrinciple": "Blank",
  "VendorAccountNumber": "",
  "ProductColorId": "",
  "CatchWeightQuantity": 0,
  "PhysicalProductWidth": 0,
  "RouteOperationNumber": 0,
  "ConfigurationGroupId": "",
  "ConstantScrapQuantity": 0,
  "ProductStyleId": "",
  "Quantity": 1,
  "SubRouteId": "",
  "QMSAllowOverDispensing": "No",
  "QMSUnderDispensePercentage": 0,
  "QMSOverDispensePercentage": 0
}
```

---

### BillOfMaterialsVersions

**Full Columns**:
`dataAreaId`, `ManufacturedItemNumber`, `BOMId`, `ProductionSiteId`, `ProductConfigurationId`, `ProductColorId`, `ProductSizeId`, `ProductStyleId`, `IsActive`, `ValidFromDate`, `FromQuantity`, `CatchWeightSize`, `IsSelectedForDesigner`, `ApproverPersonnelNumber`, `IsApproved`, `FromCatchWeightQuantity`, `ApproverId`, `VersionName`, `ValidToDate`, `TOC_BOMFinalRM_ID`, `ItemId`

**Raw JSON Sample**:
```json
{
  "@odata.etag": "W/\"JzE0NjkzMzA3MzEsNTYzNzE0NDU3Nyc=\"",
  "dataAreaId": "mpg",
  "ManufacturedItemNumber": "2312000016678",
  "BOMId": "MPG/BOM/2202/000001",
  "ProductionSiteId": "MPG",
  "ProductConfigurationId": "",
  "ProductColorId": "",
  "ProductSizeId": "S",
  "ProductStyleId": "",
  "IsActive": 0,
  "ValidFromDate": "2023-12-28T12:00:00Z",
  "FromQuantity": 1,
  "CatchWeightSize": 0,
  "IsSelectedForDesigner": "No",
  "ApproverPersonnelNumber": "000002",
  "IsApproved": "Yes",
  "FromCatchWeightQuantity": 0,
  "ApproverId": 5637144576,
  "VersionName": "Menstop Arshan 2 White",
  "ValidToDate": "1900-01-01T12:00:00Z",
  "TOC_BOMFinalRM_ID": "",
  "ItemId": "2312000016678"
}
```

---

### BillOfMaterialsVersionsV4

**Full Columns**:
`dataAreaId`, `ManufacturedItemNumber`, `BOMId`, `ProductionSiteId`, `ProductConfigurationId`, `ProductColorId`, `ProductSizeId`, `ProductStyleId`, `ProductVersionId`, `IsActive`, `ValidFromDate`, `FromQuantity`, `SequenceId`, `CatchWeightSize`, `IsSelectedForDesigner`, `ApproverPersonnelNumber`, `IsApproved`, `FromCatchWeightQuantity`, `VersionName`, `ValidToDate`

**Raw JSON Sample**:
```json
{
  "@odata.etag": "W/\"JzE3NDYyNzgzMTEsNTYzNzM1MTU3Nyc=\"",
  "dataAreaId": "mpg",
  "ManufacturedItemNumber": "2407000000468",
  "BOMId": "MPG/BOM/2410/000362",
  "ProductionSiteId": "MPG",
  "ProductConfigurationId": "",
  "ProductColorId": "",
  "ProductSizeId": "6XL",
  "ProductStyleId": "",
  "ProductVersionId": "",
  "IsActive": "No",
  "ValidFromDate": "2024-08-22T12:00:00Z",
  "FromQuantity": 1,
  "SequenceId": 1,
  "CatchWeightSize": 0,
  "IsSelectedForDesigner": "No",
  "ApproverPersonnelNumber": "",
  "IsApproved": "No",
  "FromCatchWeightQuantity": 0,
  "VersionName": "2407000000468",
  "ValidToDate": "1900-01-01T12:00:00Z"
}
```

---

## Job Transactions (Real-Time Factory Floor)

### JobTransactionHeaders

**Full Columns**:
`dataAreaId`, `JobTransactionId`, `IsOpen`, `ProductionGroup`, `IsStarted`, `QtyOrder`, `Season`, `OprNext`, `PreviousOperation`, `RejectQty`, `Operation`, `ArticleName`, `NextOperation`, `OutputQty`, `resource`, `Brand`, `StartTime`, `ModifiedDateTime1`, `ArticleId`, `Notes`, `BalanceQty`, `OprNum`, `TransferQty`, `CreatedDateTime1`, `StopTime`, `PlanDate`

**Raw JSON Sample**:
```json
{
  "@odata.etag": "W/\"JzMwMDkxNTE4Niw1NjM3MTQ0NTc5Jw==\"",
  "dataAreaId": "mpg",
  "JobTransactionId": "MPG/JOB/2604/000155",
  "IsOpen": "No",
  "ProductionGroup": "MPG/PRG/2604/000048",
  "IsStarted": "No",
  "QtyOrder": 2049,
  "Season": "",
  "OprNext": 0,
  "PreviousOperation": "",
  "RejectQty": 0,
  "Operation": "IN-Cut",
  "ArticleName": "MOC Dasarata Beige",
  "NextOperation": "IN-Sew",
  "OutputQty": 0,
  "resource": "Cutting",
  "Brand": "MOC",
  "StartTime": "2026-04-30T05:05:06Z",
  "ModifiedDateTime1": "2026-04-30T06:42:38Z",
  "ArticleId": "2312000012739",
  "Notes": "",
  "BalanceQty": 0,
  "OprNum": 0,
  "TransferQty": 0,
  "CreatedDateTime1": "2026-04-16T02:45:07Z",
  "StopTime": "2026-04-30T05:05:47Z",
  "PlanDate": "1900-01-01T12:00:00Z"
}
```

---

### JobTransactionLines

**Full Columns**:
`dataAreaId`, `JobTransactionId`, `No`, `RemainQty`, `Operation`, `OutputQty`, `ReasonReject`, `RejectQty`, `TransDate`, `resource`

**Raw JSON Sample**:
```json
{
  "@odata.etag": "W/\"JzIwOTY2NTcwNjIsNTYzODIwODEwMCc=\"",
  "dataAreaId": "mpg",
  "JobTransactionId": "MPG/JOB/2604/000155",
  "No": 1,
  "RemainQty": 0,
  "Operation": "IN-Cut",
  "OutputQty": 0,
  "ReasonReject": "",
  "RejectQty": 0,
  "TransDate": "2026-04-30T12:00:00Z",
  "resource": "Cutting"
}
```

---

### JobTransactionLinesDetails

**Full Columns**:
`dataAreaId`, `No`, `JobTransactionId`, `ItemId`, `Size`, `GlobalDisplayOrder`, `Jam9`, `Jam7`, `Jam12`, `Jam13`, `Jam10`, `Jam11`, `RejectProduksi`, `Jam16`, `Jam17`, `Jam14`, `Jam15`, `Jam18`, `Jam19`, `RejectFinishing`, `Jam22`, `RejectEmbro`, `Jam23`, `Jam20`, `Jam21`, `Jam24`, `QtyOrder`, `Jam4`, `Jam1`, `TotalQtySample`, `Jam2`, `Jam5`, `BarangHilang`, `RejectCutting`, `TotalRejectQty`, `Jam6`, `RejectPrinting`, `RefRecId`, `TotalGoodQty`, `RejectSewing`, `RejectWashing`, `Gramasi`, `BTJ`, `RejectBahan`, `Jam8`, `Jam3`

**Raw JSON Sample**:
```json
{
  "@odata.etag": "W/\"JzE4MTQwNDA0NjYsNTYzODIxMTIwNSc=\"",
  "dataAreaId": "mpg",
  "No": 1,
  "JobTransactionId": "MPG/JOB/2604/000155",
  "ItemId": "2312000012739",
  "Size": "3L",
  "GlobalDisplayOrder": 0,
  "Jam9": 0,
  "Jam7": 182,
  "Jam12": 0,
  "Jam13": 0,
  "Jam10": 0,
  "Jam11": 0,
  "RejectProduksi": 0,
  "Jam16": 0,
  "Jam17": 0,
  "Jam14": 0,
  "Jam15": 0,
  "Jam18": 0,
  "Jam19": 0,
  "RejectFinishing": 0,
  "Jam22": 0,
  "RejectEmbro": 0,
  "Jam23": 0,
  "Jam20": 0,
  "Jam21": 0,
  "Jam24": 0,
  "QtyOrder": 184,
  "Jam4": 0,
  "Jam1": 0,
  "TotalQtySample": 0,
  "Jam2": 0,
  "Jam5": 0,
  "BarangHilang": 0,
  "RejectCutting": 0,
  "TotalRejectQty": 0,
  "Jam6": 0,
  "RejectPrinting": 0,
  "RefRecId": 0,
  "TotalGoodQty": 182,
  "RejectSewing": 0,
  "RejectWashing": 0,
  "Gramasi": 0,
  "BTJ": 0,
  "RejectBahan": 0,
  "Jam8": 0,
  "Jam3": 0
}
```

---



---

# AWS PostgreSQL Database Schema

This section defines the internal relational database models used to synchronize, cache, and optimize the D365 data for our high-speed frontend dashboards.

## 1. PLM Core Entities

### plm_activity
**Purpose**: The central node representing an active style/production task.
*   **Primary Key**: `PLMId`
*   **Key Columns**: `Brand`, `Season`, `ArticleName`, `GroupId`, `PLMActivityStatus`, `ProductionGroup`
*   **Relationships**: 
    *   One-to-Many with `plm_trans`
    *   One-to-Many with `po_lines`
    *   One-to-One with `plm_activity_shadowing`
    *   One-to-Many with `production_group_lines`

**Raw JSON Sample**:
```json
{
  "PLMId": "PLM/26/02/00142",
  "odata_etag": "W/\"JzEzOTI0MTAwMDgsNTYzNzQ4NzMzNyc=\"",
  "dataAreaId": "mpr",
  "Fitting2": "Standard",
  "PlanStartDate": "2026-08-30T12:00:00Z",
  "ArticleName": "Manzone Carmenta 01 Black",
  "IsCancel": "No",
  "Brand": "Manzone",
  "PlanEndDate": "1900-01-01T12:00:00Z",
  "Capsule": "ESSENTIAL",
  "SeasonDate": "1900-01-01T12:00:00Z",
  "Sablon": null,
  "TechPack": "New",
  "World": "Essential",
  "Season": "WINTER-26",
  "Pleats": null,
  "ModifiedDateTime1": "2026-02-20T04:19:35Z",
  "InventColorId": "",
  "LotId": "Lot 1-2",
  "PLMActivityStatus": "Started",
  "CreatedDateTime1": "2026-02-20T04:19:35Z",
  "SubBrand": "",
  "Department": "Men",
  "Origin": "INA",
  "ArticleCode": "2601000000706",
  "InventStyleId": "",
  "CreatedBy1": "Dimas",
  "FDR": "Existing",
  "Other": null,
  "Fitting1": "Slim Fit",
  "GroupId": "GROUP/25/09/00026",
  "Washing": null,
  "GroupName": "INA/FDRX/ADRN",
  "Category": "Top",
  "ADR": "New",
  "Embro": null,
  "Colour": "",
  "ProductLooks": "Slub",
  "SubCategory": "Polo Shirt"
}
```

### plm_trans
**Purpose**: Sub-tasks or stage gates for a specific PLM Activity (e.g., BOM Final RM creation).
*   **Primary Key**: `id` (autoincrement)
*   **Foreign Key**: `PLMId` (references `plm_activity.PLMId` ON DELETE CASCADE)
*   **Key Columns**: `ActivityNo`, `PlanStartDate`, `PlanEndDate`, `ActualStartDate`, `ActualEndDate`
*   **Unique Constraint**: `PLMId`, `LineNumber`, `SequenceId`

**Raw JSON Sample**:
```json
{
  "id": 253111,
  "odata_etag": "W/\"JzE1MTU1MzUwMDEsNTYzNzQ2MDU4NCc=\"",
  "dataAreaId": "mpr",
  "PLMId": "PLM/26/02/00142",
  "ActivityName": "FDR",
  "EnableStart": "No",
  "Start": "Start",
  "Change": "Change",
  "ActivityNo": "FDR/26/02/00051",
  "ActualDuration": "1",
  "ActualStartDate": "2026-02-27T12:00:00Z",
  "ParentActivity": "",
  "userId": "",
  "ArticleName": "Manzone Carmenta 01 Black",
  "ActivityId": "ACT/25/09/00629",
  "PlanEndDate": "2026-02-20T12:00:00Z",
  "ArticleCode": "2601000000706",
  "SequenceId": 1,
  "PLMActivityStatus": "Completed",
  "CreatedBy1": "Dimas",
  "DurationDays": "7",
  "GroupId": "GROUP/25/09/00026",
  "ModifiedDateTime1": "2026-04-24T09:33:26Z",
  "GroupName": "INA/FDRX/ADRN",
  "PlanStartDate": "2026-02-14T12:00:00Z",
  "Complete": "Complete",
  "CreatedDateTime1": "2026-02-20T04:19:35Z",
  "ActualEndDate": "2026-04-24T12:00:00Z",
  "LineNumber": 2
}
```

### plm_activity_shadowing
**Purpose**: A dynamic overriding table that acts as the single source of truth for the production dashboard. It shadows "Started" styles that are actually completed or stalled on the factory floor.
*   **Primary Key / Foreign Key**: `PLMId` (references `plm_activity.PLMId` ON DELETE CASCADE)
*   **Key Columns**: `ProductionGroup`, `ActualStatus` (e.g., 'Finished in Production', 'Force Closed (Stalled > 6 Months)'), `ShadowedAt`

**Raw JSON Sample**:
```json
{
  "PLMId": "PLM/25/12/00011",
  "ProductionGroup": "MPG/PRG/2604/000021",
  "ActualStatus": "Force Closed (Stuck in Production > 6 Months)",
  "ShadowedAt": "2026-05-05T07:33:04.373399"
}
```

### production_group_lines
**Purpose**: Holds the production group mappings (including quantities and associated BOMs) linking production records to their primary styles.
*   **Primary Key**: `ProdId`
*   **Foreign Key**: `ProductionGroup` (references `plm_activity.ProductionGroup` ON DELETE SET NULL)
*   **Key Columns**: `ItemId`, `Size`, `RetailVariantId`, `ProductVariantNumber`, `CodeBars`, `Gramasi`, `SalesPrice`, `SalesPriceDate`, `SearchName`, `UnitCost`, `UnitCostDate`, `dataAreaId`, `No`, `LineNum`, `BOMId`, `Qty`, `InventLocationId`

---

## 2. Procurement Entities

### po_headers
**Purpose**: High-level purchase order metadata linked to specific factory locations.
*   **Primary Key**: `PurchaseOrderNumber`
*   **Key Columns**: `PurchaseOrderName`, `OrderVendorAccountNumber`, `PurchaseOrderStatus`, `PurchPoolId`, `RequestedDeliveryDate`
*   **Relationships**: One-to-Many with `po_lines`

**Raw JSON Sample**:
```json
{
  "PurchaseOrderNumber": "PO01-23020020",
  "odata_etag": "W/\"JzE1ODg1NTMxMDksNTYzNzE0NDU3NjswLDA7MSw1NjM3MTQ1MzI3OzEsNTYzNzE0NDU3NjswLDA7MCwwJw==\"",
  "dataAreaId": "mpg",
  "PurchaseOrderName": "PT PULAU INTAN LESTARI",
  "OrderVendorAccountNumber": "V0043",
  "PurchaseOrderStatus": "Backorder",
  "PurchPoolId": "Fab-Local",
  "DocumentApprovalStatus": "Confirmed",
  "RequestedDeliveryDate": "2023-02-28T12:00:00Z",
  "ModifiedDateTime1": "2024-07-04T18:08:37Z",
  "CreatedBy1": "faldhi.firdaus",
  "CreatedDateTime1": "2024-01-01T18:35:42Z"
}
```

### po_lines
**Purpose**: The actual fabric/raw material procurement lines. Maps raw materials to their intended PLM styles.
*   **Primary Key**: `id` (autoincrement)
*   **Foreign Key 1**: `PurchaseOrderNumber` (references `po_headers.PurchaseOrderNumber` ON DELETE CASCADE)
*   **Foreign Key 2**: `PLMId` (references `plm_activity.PLMId` ON DELETE SET NULL)
*   **Key Columns**: `ItemNumber`, `LineDescription`, `OrderedPurchaseQuantity`, `LineAmount`
*   **Unique Constraint**: `PurchaseOrderNumber`, `LineNumber`

**Raw JSON Sample**:
```json
{
  "id": 1234,
  "odata_etag": "W/\"JzEzMjg0NzM3NjUsNTYzNzU2MzgzMzsxLDU2MzcxODg4MjY7MCwwOzAsMDswLDA7MCwwOzAsMCc=\"",
  "dataAreaId": "mpg",
  "PurchaseOrderNumber": "MPG/PO/2407/00083",
  "LineNumber": 1,
  "PLMId": null,
  "ItemNumber": "2403000004617",
  "LineDescription": "KNITTING 100% COTTON CM 24'S 180 GSM SINGLE JERSEY SOLID ENZYMED SJ-HS01 SUPERBLACK",
  "PurchaseOrderLineStatus": "Invoiced",
  "PurchaseUnitSymbol": "KG",
  "OrderedPurchaseQuantity": 119.0,
  "LineAmount": 14258558.58,
  "UnitWeight": 0.0,
  "ItemBatchNumber": "Minimal Bb Nona Blouse Black",
  "RequesterPersonnelNumber": "12101118",
  "CustomerReference": "MPG/PC/PDV/24/V/22",
  "PurchaseRequisitionId": "PR/24/05/00502",
  "ModifiedDateTime1": "2024-11-30T13:00:42Z"
}
```
