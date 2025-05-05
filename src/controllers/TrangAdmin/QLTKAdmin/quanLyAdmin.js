const {uploadSingleFile, uploadMultipleFiles} = require("../../../services/fileService")
const FormatPriceAndEditImage = require("../../../services/formartTien_EditAnh");
const mongoose = require('mongoose');
const { Types: { ObjectId } } = require('mongoose');

const moment = require('moment-timezone');
const Token = require("../../../models/Token");
const ChucNang = require("../../../models/ChucNang");
const TaiKhoan_Admin = require("../../../models/TaiKhoan_Admin");
const PhanQuyen = require("../../../models/PhanQuyen");
require('rootpath')();

function convertToVietnamTime(dateTime) {
    return moment(dateTime).tz('Asia/Ho_Chi_Minh').format('DD-MM-YYYY ');
}

async function KiemTraChucNang(req, idChucNang){    
    let userId = req.session.userId
    let checkToken = await Token.findOne({userId: userId}).populate("userId")

    let count = await PhanQuyen.findOne({
        IdAdminNhanVien: checkToken.userId._id,
        IdChucNang: idChucNang
    });
    console.log("count: ", count);

    return !!count;
}

module.exports = {

    getPageQLAdmin_PhanTrang: async (req, res) => {
        let redirectUrl = '/list-account-admin';
        const page = req.query.page || '';      
        const locTheoStatus = req.query.locTheoStatus || '';         

        let queryParams = '';    
        if (locTheoStatus) {
            queryParams += `?locTheoStatus=${locTheoStatus}`;
        }    
        if (page) {
            queryParams += `${queryParams ? '&' : '?'}page=${page}`;
        }        

        redirectUrl += queryParams;
        return res.redirect(redirectUrl);
    },

    getPageQLAdmin_Search_PhanTrang: (req, res) => { 
        let redirectUrl = '/list-account-admin';
        const searchAD = req.query.searchAD || '';
        const page = req.query.page || '';        
        const locTheoStatus = req.query.locTheoStatus || '';        

        let queryParams = '';
        if (searchAD) {
            queryParams += `?searchAD=${searchAD}`;
        }
        if (page) {
            queryParams += `${queryParams ? '&' : '?'}page=${page}`;
        }

        redirectUrl += queryParams;
        return res.redirect(redirectUrl);
    },

    getPageQLAdmin: async (req, res) => {
        let activee = 'active_quanLyTKAdmin';
        let activeee = 'active_quanLyTKAdmin_list';
        let userId = req.session.userId
        let checkToken = await Token.findOne({userId: userId}).populate("userId")
        let checkToken2 = await Token.find({}).populate("userId")

        let searchAD = req.query.searchAD;
        let locTheoStatus = req.query.locTheoStatus;

        req.session.searchAD = searchAD;
        req.session.locTheoStatus = locTheoStatus;

        let page = 1;
        const limit = 5;
        if(req.query.page){
            page = parseInt(req.query.page);
            page = page < 1 ? 1 : page;
        }
        let skip = (page - 1) * limit;

        let query = {};
        if (searchAD) {
            query.TenDangNhap = { $regex: new RegExp(searchAD, 'i') };
        }
        if (locTheoStatus) {
            query.deleted = locTheoStatus;
        }

        let listAD = await TaiKhoan_Admin.find(query).skip(skip).limit(limit).exec();
        let chucNang = await ChucNang.find({})

        const listADWithTime = listAD.map(item => ({
            ...item._doc,
            createdAt: convertToVietnamTime(item.createdAt),
            updatedAt: convertToVietnamTime(item.updatedAt),
        }));

        const totalTkAdmin = await TaiKhoan_Admin.countDocuments(query);
        const numPage = Math.ceil(totalTkAdmin / limit);

        function findEmployeeIndex(listADWithTimeId, employeesArray) {
            for (let i = 0; i < employeesArray.length; i++) {
                if (listADWithTimeId === employeesArray[i]._idAdminNV.toString()) {
                    return i;
                }
            }
            return -1;
        }
        function findItemIndex(value, array, key) {
            for (let i = 0; i < array.length; i++) {
                if (value === array[i][key].toString()) {
                    return i;
                }
            }
            return -1;
        }

        const allPhanQuyen  = await PhanQuyen.find({}).populate('IdAdminNhanVien').populate('IdChucNang').exec();
        console.log("tai khoan admin: ", allPhanQuyen);

        let employees = {};

        allPhanQuyen.forEach((phanQuyen) => {
            const { IdAdminNhanVien, IdChucNang } = phanQuyen;

            if (!IdAdminNhanVien || !IdChucNang) {
                console.warn("Bỏ qua bản ghi PhanQuyen bị null:", phanQuyen);
                return;
            }

            if (!employees[IdAdminNhanVien._id]) {
                employees[IdAdminNhanVien._id] = {   
                    _idAdminNV: IdAdminNhanVien._id,                 
                    GhiChu: phanQuyen.GhiChu,
                    TenChucNang: []
                };
            }

            employees[IdAdminNhanVien._id].TenChucNang.push(IdChucNang.TenChucNang);
        });

        const employeesArray = Object.values(employees);
        console.log("employeesArray: ", employeesArray);

        if(checkToken) {
            if(await KiemTraChucNang(req, '65eb06c95d2a4f66ed3852e4') === false){
                return res.render("TrangAdmin/khongCoQuyenTruyCap.ejs", {
                    activee: "khongcoquyen",
                    activeee: "khongcoquyen",
                    user: checkToken.userId.TenDangNhap,
                    hoten: checkToken.userId.HoTen,
                    token: checkToken.token                                    
                })
            }

            res.render("TrangAdmin/QLTKAdmin/getPageQLAdmin.ejs", {
                totalItems: totalTkAdmin,
                soTrang: numPage, limit,
                curPage: page,
                user: checkToken.userId.TenDangNhap,
                token: checkToken.token,
                hoten: checkToken.userId.HoTen,
                activee, activeee,
                listADWithTime: listADWithTime, checkToken2, 
                chucNang, employeesArray, findEmployeeIndex, findItemIndex,
                ssSearchAd: req.session.searchAD || "", 
                locTheoStatus: req.session.locTheoStatus || "", 
            })
        } else {
            res.render("TrangAdmin/Login/loginAdmin.ejs", {})
        }        
    },

    createTKAdmin: async (req, res) => {

        let {TenDangNhap, MatKhau, HoTen, SDT} = req.body

        console.log(`TenDangNhap: ${TenDangNhap}, MatKhau: ${MatKhau}, HoTen: ${HoTen}, SDT: ${SDT}`);

        let createAD = await TaiKhoan_Admin.create({
            TenDangNhap: TenDangNhap,
            MatKhau: MatKhau,
            HoTen: HoTen,
            SDT: SDT
        })

        if(createAD) {
            console.log("thêm thành công tài khoản");
            return res.status(200).json({
                data: createAD,
                success: true,
                message: "Thêm tài khoản admin thành công"
            })
        } else {
            return res.status(500).json({                
                success: false,
                message: "Thêm tài khoản admin thất bại"
            })
        }
    },

    deleteTKAdmin: async (req, res) => {
        let idXoa = req.params.idXoa

        let xoaAD = await TaiKhoan_Admin.delete({_id: idXoa})

        if(xoaAD) {
            return res.status(200).json({
                data: xoaAD,
                success: true,
                message: "Bạn đã xoá tài khoản admin thành công!"
            })
        } else {
            return res.status(500).json({
                success: false,
                message: "Bạn đã xoá tài khoản admin thất bại!"
            })
        }
    },

    deleteTokenAdmin: async (req, res) => {
        let idXoaToken = req.params.idXoaToken

        let xoaTokenAD = await Token.deleteOne({_id: idXoaToken})

        if(xoaTokenAD) {
            return res.status(200).json({
                data: xoaTokenAD,
                success: true,
                message: "Bạn đã xoá phiên thành công!"
            })
        } else {
            return res.status(500).json({
                success: false,
                message: "Bạn đã xoá phiên thất bại!"
            })
        }
    },

    createTKAdminPhanQuyen: async (req, res) => {

        let IdDangNhap = req.body.IdDangNhap;
        let ChucNang = req.body.ChucNang;
        let GhiChu = req.body.GhiChu;

        console.log("Ten: ", IdDangNhap, "\n Chuc Nang: ", ChucNang, "\n GhiChu: ", GhiChu);

        // Tạo đối tượng PhanQuyen
        const phanQuyenDocs = ChucNang.map(chucNangId => ({
            IdAdminNhanVien: IdDangNhap,
            IdChucNang: chucNangId,
            GhiChu: GhiChu
        }));

        try {            
            // Chèn nhiều đối tượng vào cơ sở dữ liệu
            await PhanQuyen.deleteMany({ IdAdminNhanVien: IdDangNhap });
            let result = await PhanQuyen.insertMany(phanQuyenDocs);            
            console.log("Updated  documents: ", result);

            if (result) {
                console.log("result: ", result);
                return res.status(200).json({
                    message: "Cập nhật phân quyền thành công!",
                    success: true,
                    KQ: 0,
                    data: result
                });
            } else {
                return res.status(404).json({
                    message: "Không tìm thấy bản ghi để cập nhật!",
                    success: false,
                    KQ: -1
                });
            }

        } catch (error) {
            console.error("Error occurred while inserting documents: ", error);
        }
    },

    suaTaiKhoanDangKhoa: async (req, res) => {
        let idSua = req.params.idSua
        let moKhoaTK = req.body.moKhoaTK

        console.log("idSua: ", idSua);

        if (moKhoaTK === 'true') {
            moKhoaTK = false;
        } else {
            moKhoaTK = true;
        }
        console.log("moKhoaTK: ", moKhoaTK);

        let update = await TaiKhoan_Admin.updateOne({_id: idSua},{deleted: moKhoaTK})
        let check = await TaiKhoan_Admin.findOne({_id: idSua})

        if(check.deleted){
            return res.status(200).json({
                message: "Không có sự thay đổi nào!",
                success: true,
                check: true,
                errCode: 0,
                data: check
            })
        }

        if(update){
            console.log(">>> check update: ", update);
            return res.status(200).json({
                message: "Bạn đã mở lại tài khoản thành công!",
                success: true,
                errCode: 0,
                check: false,
                data: update
            })
        } else {
            return res.status(500).json({
                message: "Lỗi mẹ rồi!",
                success: false,
                errCode: -1,
            })
        }  
    },

    suaTaiKhoanADMIN: async (req, res) => {
        let idSua = req.params.idSua
        let TenDangNhap = req.body.TenDangNhap
        let HoTen = req.body.HoTen
        let MatKhau = req.body.MatKhau
        let SDT = req.body.SDT
       
        let check = await TaiKhoan_Admin.findOne({_id: idSua})
        if( check.HoTen === HoTen &&
            check.MatKhau === MatKhau &&
            check.SDT === SDT ){
            return res.status(200).json({
                message: "Không có sự thay đổi nào!",
                success: true,
                check: true,
                errCode: 0,
                data: check
            })
        }        

        let update = await TaiKhoan_Admin.updateOne({_id: idSua},{            
            HoTen: HoTen,
            MatKhau: MatKhau,
            SDT: SDT,
        })

        if(update){
            console.log(">>> check update: ", update);
            return res.status(200).json({
                message: "Sửa tài khoản thành công!",
                success: true,
                errCode: 0,
                check: false,
                data: update
            })
        } else {
            return res.status(500).json({
                message: "Lỗi rồi!",
                success: false,
                errCode: -1,
            })
        }  
    },
}